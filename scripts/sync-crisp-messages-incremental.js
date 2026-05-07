/**
 * sync-crisp-messages-incremental.js
 *
 * Sincronización INCREMENTAL de mensajes Crisp → BigQuery con enriquecimiento NLP.
 *
 * Comportamiento:
 *   1. Detecta sesiones nuevas en crisp_conversations que NO tienen mensajes en crisp_messages
 *   2. También rellena sentiment_score en mensajes de usuario que tengan NULL
 *   3. Usa upsert por message_id para garantizar idempotencia
 *
 * Uso:
 *   node scripts/sync-crisp-messages-incremental.js
 *   node scripts/sync-crisp-messages-incremental.js --sentiment-only  (solo rellena NLP faltante)
 */
require('dotenv').config({ path: '../.env' });
const { BigQuery }  = require('@google-cloud/bigquery');
const language      = require('@google-cloud/language');
const crypto        = require('crypto');

const DATASET_ID  = 'ecommerce_data';
const PROJECT_ID  = process.env.GCP_PROJECT_ID;
const BATCH_SIZE  = 50;  // mensajes por batch de NLP
const SLEEP_MS    = 400; // anti-rate-limit Crisp
const NLP_SLEEP_MS = 100; // anti-rate-limit Natural Language API

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Helpers NLP ───────────────────────────────────────────────────────────────

async function analyzeSentiment(nlpClient, text) {
  try {
    const [result] = await nlpClient.analyzeSentiment({
      document: { content: text, type: 'PLAIN_TEXT' }
    });
    return {
      score:     result.documentSentiment.score,
      magnitude: result.documentSentiment.magnitude
    };
  } catch {
    return { score: null, magnitude: null };
  }
}

// ── Helpers Crisp API ─────────────────────────────────────────────────────────

async function fetchMessages(sessionId, auth, websiteId, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(
      `https://api.crisp.chat/v1/website/${websiteId}/conversation/${sessionId}/messages`,
      { headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' } }
    );
    if (res.status === 429) { await sleep(10000); continue; }
    if (res.ok) return (await res.json()).data ?? [];
    return [];
  }
  return [];
}

// ── Upsert de mensajes ────────────────────────────────────────────────────────

async function upsertMessages(bigquery, rows) {
  if (rows.length === 0) return;
  const staging = `${PROJECT_ID}.${DATASET_ID}.crisp_messages_staging`;
  const target  = `${PROJECT_ID}.${DATASET_ID}.crisp_messages`;

  await bigquery.query(`CREATE OR REPLACE TABLE \`${staging}\` AS SELECT * FROM \`${target}\` WHERE FALSE`);
  const table = bigquery.dataset(DATASET_ID).table('crisp_messages_staging');
  for (let i = 0; i < rows.length; i += 500) {
    await table.insert(rows.slice(i, i + 500));
  }
  await bigquery.query(`
    MERGE \`${target}\` T
    USING \`${staging}\` S ON T.message_id = S.message_id
    WHEN MATCHED AND T.sentiment_score IS NULL AND S.sentiment_score IS NOT NULL THEN
      UPDATE SET T.sentiment_score = S.sentiment_score, T.sentiment_magnitude = S.sentiment_magnitude
    WHEN NOT MATCHED THEN INSERT ROW
  `);
  await bigquery.query(`DROP TABLE IF EXISTS \`${staging}\``);
}

// ── Fase 1: Sincronizar mensajes de sesiones nuevas ──────────────────────────

async function syncNewSessionMessages(bigquery, nlpClient, auth, websiteId) {
  const sentimentOnly = process.argv.includes('--sentiment-only');
  if (sentimentOnly) {
    console.log('Modo --sentiment-only: saltando fase de sesiones nuevas.');
    return 0;
  }

  // Sesiones en crisp_conversations que no tienen ningún mensaje en crisp_messages
  const [sessions] = await bigquery.query(`
    SELECT c.session_id
    FROM \`${PROJECT_ID}.${DATASET_ID}.crisp_conversations\` c
    LEFT JOIN (
      SELECT DISTINCT session_id FROM \`${PROJECT_ID}.${DATASET_ID}.crisp_messages\`
    ) m ON c.session_id = m.session_id
    WHERE m.session_id IS NULL
    ORDER BY c.created_at
  `);

  if (sessions.length === 0) {
    console.log('Fase 1: No hay sesiones nuevas sin mensajes.');
    return 0;
  }

  console.log(`Fase 1: ${sessions.length} sesiones nuevas sin mensajes. Extrayendo...`);
  let total = 0;

  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i].session_id;
    const msgs      = await fetchMessages(sessionId, auth, websiteId);

    const rows = [];
    for (const msg of msgs) {
      if (msg.type !== 'text') continue;
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const sender  = msg.from;
      let operator_name = null;
      if (sender === 'operator' && msg.user?.nickname) operator_name = msg.user.nickname;

      let sentiment_score = null, sentiment_magnitude = null;
      if (sender === 'user' && content.length > 3) {
        const s = await analyzeSentiment(nlpClient, content);
        sentiment_score     = s.score;
        sentiment_magnitude = s.magnitude;
        await sleep(NLP_SLEEP_MS);
      }

      rows.push({
        message_id:          String(msg.fingerprint || crypto.randomUUID()),
        session_id:          sessionId,
        created_at:          bigquery.timestamp(new Date(msg.timestamp)),
        sender_type:         sender,
        operator_name,
        content,
        sentiment_score,
        sentiment_magnitude,
      });
    }

    if (rows.length > 0) {
      await upsertMessages(bigquery, rows);
      total += rows.length;
    }

    process.stdout.write(`\r  Sesión ${i + 1}/${sessions.length} | Mensajes: ${total}`);
    await sleep(SLEEP_MS);
  }

  console.log(`\nFase 1 completada: ${total} mensajes insertados.`);
  return total;
}

// ── Fase 2: Rellenar sentiment_score NULL ────────────────────────────────────

async function fillMissingSentiment(bigquery, nlpClient) {
  const [pending] = await bigquery.query(`
    SELECT message_id, content
    FROM \`${PROJECT_ID}.${DATASET_ID}.crisp_messages\`
    WHERE sender_type = 'user'
      AND sentiment_score IS NULL
      AND content IS NOT NULL
      AND LENGTH(content) > 3
    ORDER BY created_at
    LIMIT 500
  `);

  if (pending.length === 0) {
    console.log('Fase 2: No hay mensajes con sentiment_score pendiente.');
    return 0;
  }

  console.log(`\nFase 2: ${pending.length} mensajes sin sentiment_score. Procesando en batches de ${BATCH_SIZE}...`);
  let updated = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const rows  = [];

    for (const row of batch) {
      const s = await analyzeSentiment(nlpClient, row.content);
      if (s.score !== null) {
        rows.push({
          message_id:          row.message_id,
          session_id:          '', // No modificado en upsert
          created_at:          bigquery.timestamp(new Date()),
          sender_type:         'user',
          operator_name:       null,
          content:             row.content,
          sentiment_score:     s.score,
          sentiment_magnitude: s.magnitude,
        });
      }
      await sleep(NLP_SLEEP_MS);
    }

    if (rows.length > 0) {
      await upsertMessages(bigquery, rows);
      updated += rows.length;
    }
    process.stdout.write(`\r  Procesados: ${Math.min(i + BATCH_SIZE, pending.length)}/${pending.length} | Actualizados: ${updated}`);
  }

  console.log(`\nFase 2 completada: ${updated} mensajes enriquecidos con NLP.`);
  return updated;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== SYNC CRISP MENSAJES (INCREMENTAL + NLP) ===\n');
  try {
    const bigquery  = new BigQuery({ projectId: PROJECT_ID });
    const nlpClient = new language.LanguageServiceClient();
    const auth      = Buffer.from(`${process.env.CRISP_IDENTIFIER}:${process.env.CRISP_KEY}`).toString('base64');
    const websiteId = process.env.CRISP_WEBSITE_ID;

    const f1 = await syncNewSessionMessages(bigquery, nlpClient, auth, websiteId);
    const f2 = await fillMissingSentiment(bigquery, nlpClient);

    console.log(`\n=== COMPLETADO ✅ | Mensajes nuevos: ${f1} | NLP rellenados: ${f2} ===`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

run();
