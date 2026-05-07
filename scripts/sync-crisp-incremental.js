/**
 * sync-crisp-incremental.js
 *
 * Sincronización INCREMENTAL de conversaciones Crisp → BigQuery.
 * Solo extrae registros nuevos o actualizados desde el último MAX(updated_at) en BQ.
 * Utiliza MERGE (upsert) para evitar duplicados y no tocar registros existentes.
 *
 * Uso:
 *   node scripts/sync-crisp-incremental.js
 *   node scripts/sync-crisp-incremental.js --full   (fuerza sincronización completa desde 2026-01-01)
 */
require('dotenv').config({ path: '../.env' });
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID    = 'ecommerce_data';
const TABLE_ID      = 'crisp_conversations';
const PROJECT_ID    = process.env.GCP_PROJECT_ID;
const FULL_SYNC_START = '2026-01-01T00:00:00Z';
const MAX_EMPTY_PAGES = 3;
const PAGE_DELAY_MS   = 250;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Helpers ──────────────────────────────────────────────────────────────────

async function crispGet(url, auth, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });
    if (res.status === 429) {
      console.log(`  [Rate Limit] Esperando 10s (intento ${i + 1}/${retries})...`);
      await sleep(10000);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Crisp API error ${res.status}: ${res.statusText}`);
    return res.json();
  }
  throw new Error('Máximos reintentos agotados por rate limit.');
}

function buildRow(c, bigquery) {
  let rating_value   = null;
  let rating_comment = null;
  if (c.meta?.rating) {
    rating_value   = c.meta.rating.value   ?? null;
    rating_comment = c.meta.rating.comment ?? null;
  }
  return {
    session_id:     c.session_id,
    created_at:     bigquery.timestamp(new Date(c.created_at)),
    updated_at:     bigquery.timestamp(new Date(c.updated_at)),
    status:         c.state || c.status || 'unknown',
    segments:       c.meta?.segments?.join(',') ?? '',
    rating_value,
    rating_comment,
  };
}

// ── Lógica principal ─────────────────────────────────────────────────────────

async function getCheckpoint(bigquery) {
  const isFullSync = process.argv.includes('--full');
  if (isFullSync) {
    console.log('Modo --full: sincronización desde', FULL_SYNC_START);
    return new Date(FULL_SYNC_START).getTime();
  }
  try {
    const [rows] = await bigquery.query(
      `SELECT UNIX_MILLIS(MAX(updated_at)) as last_ts
       FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``
    );
    const ts = rows[0]?.last_ts;
    if (ts) {
      const date = new Date(Number(ts));
      console.log(`Checkpoint incremental detectado: ${date.toISOString()}`);
      return Number(ts);
    }
  } catch (_) {}
  console.log('Sin checkpoint previo — sincronización completa desde', FULL_SYNC_START);
  return new Date(FULL_SYNC_START).getTime();
}

async function fetchNewConversations(auth, websiteId, sinceMs) {
  const conversations = [];
  const seenIds       = new Set();
  let page            = 1;
  let emptyCount      = 0;

  console.log(`\nExtrayendo conversaciones actualizadas después de ${new Date(sinceMs).toISOString()}...`);

  while (true) {
    const json = await crispGet(
      `https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`,
      auth
    );

    if (!json || !json.data || json.data.length === 0) break;

    const relevant = json.data.filter(c => c.updated_at >= sinceMs || c.created_at >= sinceMs);

    if (relevant.length === 0) {
      emptyCount++;
      if (emptyCount >= MAX_EMPTY_PAGES) {
        console.log(`\n  Deteniendo: ${MAX_EMPTY_PAGES} páginas sin datos nuevos.`);
        break;
      }
    } else {
      emptyCount = 0;
      for (const c of relevant) {
        if (!seenIds.has(c.session_id)) {
          seenIds.add(c.session_id);
          conversations.push(c);
        }
      }
    }

    process.stdout.write(`\r  Pág ${page} | Nuevas/actualizadas: ${conversations.length}`);
    page++;
    await sleep(PAGE_DELAY_MS);
  }

  console.log(`\n  Total a procesar: ${conversations.length} conversaciones.`);
  return conversations;
}

async function upsertToBigQuery(bigquery, conversations) {
  if (conversations.length === 0) {
    console.log('Nada que insertar.');
    return;
  }

  const stagingTable = `${PROJECT_ID}.${DATASET_ID}.crisp_conversations_staging`;
  const targetTable  = `${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}`;

  // 1. Crear staging temporal
  await bigquery.query(`
    CREATE OR REPLACE TABLE \`${stagingTable}\` AS
    SELECT * FROM \`${targetTable}\` WHERE FALSE
  `);

  // 2. Insertar en staging
  const table     = bigquery.dataset(DATASET_ID).table('crisp_conversations_staging');
  const rows      = conversations.map(c => buildRow(c, bigquery));
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await table.insert(rows.slice(i, i + chunkSize));
    process.stdout.write(`\r  Insertando en staging: ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
  }
  console.log('\n');

  // 3. MERGE: upsert en tabla principal
  await bigquery.query(`
    MERGE \`${targetTable}\` T
    USING \`${stagingTable}\` S
    ON T.session_id = S.session_id
    WHEN MATCHED THEN UPDATE SET
      T.updated_at     = S.updated_at,
      T.status         = S.status,
      T.segments       = S.segments,
      T.rating_value   = S.rating_value,
      T.rating_comment = S.rating_comment
    WHEN NOT MATCHED THEN INSERT ROW
  `);

  // 4. Limpiar staging
  await bigquery.query(`DROP TABLE IF EXISTS \`${stagingTable}\``);

  console.log(`✅ Upsert completado: ${rows.length} registros procesados en crisp_conversations.`);
}

async function run() {
  console.log('=== SYNC CRISP INCREMENTAL ===\n');
  try {
    const bigquery  = new BigQuery({ projectId: PROJECT_ID });
    const auth      = Buffer.from(`${process.env.CRISP_IDENTIFIER}:${process.env.CRISP_KEY}`).toString('base64');
    const websiteId = process.env.CRISP_WEBSITE_ID;

    const sinceMs       = await getCheckpoint(bigquery);
    const conversations = await fetchNewConversations(auth, websiteId, sinceMs);

    await upsertToBigQuery(bigquery, conversations);

    console.log('\n=== SYNC COMPLETADO ✅ ===');
  } catch (err) {
    console.error('\n❌ Error en sync incremental Crisp:', err.message);
    process.exit(1);
  }
}

run();
