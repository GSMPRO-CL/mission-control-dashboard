require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crispApi = require('./lib/crisp-api');

const DATASET_ID = 'ecommerce_data';
const SYNC_ID = 'crisp_conversations';
const START_OF_2026 = '2026-01-01T00:00:00.000Z';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { full: false, sinceDate: null };
  for (const arg of args) {
    if (arg === '--full') options.full = true;
    else if (arg.startsWith('--since=')) options.sinceDate = arg.replace('--since=', '');
  }
  return options;
}

async function getSyncState(bq) {
  const query = `
    SELECT last_processed_at, last_session_id, records_processed
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_sync_state\`
    WHERE sync_id = '${SYNC_ID}'
  `;
  try {
    const [rows] = await bq.query({ query });
    if (rows.length > 0) return rows[0];
  } catch (e) {
    if (!e.message.includes('Not found')) throw e;
  }
  return null;
}

async function updateSyncState(bq, state) {
  const query = `
    MERGE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_sync_state\` T
    USING (SELECT 
      @syncId as sync_id, 
      TIMESTAMP(@lastProcessedAt) as last_processed_at, 
      @lastSessionId as last_session_id, 
      CURRENT_TIMESTAMP() as last_run_at, 
      @recordsProcessed as records_processed, 
      @lastRunStatus as last_run_status, 
      @lastRunError as last_run_error, 
      CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.sync_id = S.sync_id
    WHEN MATCHED THEN
      UPDATE SET 
        last_processed_at = S.last_processed_at,
        last_session_id = S.last_session_id,
        last_run_at = S.last_run_at,
        records_processed = S.records_processed,
        last_run_status = S.last_run_status,
        last_run_error = S.last_run_error,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (sync_id, last_processed_at, last_session_id, last_run_at, records_processed, last_run_status, last_run_error, updated_at)
      VALUES (S.sync_id, S.last_processed_at, S.last_session_id, S.last_run_at, S.records_processed, S.last_run_status, S.last_run_error, S.updated_at)
  `;
  
  await bq.createQueryJob({
    query,
    params: {
      syncId: SYNC_ID,
      lastProcessedAt: state.lastProcessedAt,
      lastSessionId: state.lastSessionId || null,
      recordsProcessed: state.recordsProcessed || 0,
      lastRunStatus: state.lastRunStatus,
      lastRunError: state.lastRunError || null
    },
    types: {
      syncId: 'STRING',
      lastProcessedAt: 'STRING',
      lastSessionId: 'STRING',
      recordsProcessed: 'INT64',
      lastRunStatus: 'STRING',
      lastRunError: 'STRING'
    }
  }).then(j => j[0].promise());
}

async function writeNdjsonAndLoad(bq, stagingTableName, targetTableName, dataArray) {
  const tempFilePath = path.join(os.tmpdir(), `${stagingTableName}.ndjson`);
  const ndjsonContent = dataArray.map(obj => JSON.stringify(obj)).join('\n');
  fs.writeFileSync(tempFilePath, ndjsonContent);

  const dataset = bq.dataset(DATASET_ID);
  const stagingTable = dataset.table(stagingTableName);
  const targetTable = dataset.table(targetTableName);
  
  const [metadata] = await targetTable.getMetadata();
  const schema = metadata.schema;

  await stagingTable.create({ schema });

  await stagingTable.load(tempFilePath, {
    sourceFormat: 'NEWLINE_DELIMITED_JSON'
  });

  fs.unlinkSync(tempFilePath);
}

async function runMerge(bq, stagingTableName, targetTableName) {
  const projectId = process.env.GCP_PROJECT_ID;
  const targetPath = `\`${projectId}.${DATASET_ID}.${targetTableName}\``;
  const stagingPath = `\`${projectId}.${DATASET_ID}.${stagingTableName}\``;

  const query = `
    MERGE ${targetPath} T
    USING ${stagingPath} S
    ON T.session_id = S.session_id
    WHEN MATCHED THEN
      UPDATE SET 
        updated_at = S.updated_at,
        status = S.status,
        segments = S.segments,
        rating_value = S.rating_value,
        rating_comment = S.rating_comment,
        people_id = S.people_id,
        channel_origin = S.channel_origin,
        visitor_nickname = S.visitor_nickname,
        visitor_email = S.visitor_email,
        visitor_phone = S.visitor_phone
    WHEN NOT MATCHED THEN
      INSERT (session_id, created_at, updated_at, status, segments, rating_value, rating_comment, messages_synced, people_id, channel_origin, visitor_nickname, visitor_email, visitor_phone)
      VALUES (S.session_id, S.created_at, S.updated_at, S.status, S.segments, S.rating_value, S.rating_comment, FALSE, S.people_id, S.channel_origin, S.visitor_nickname, S.visitor_email, S.visitor_phone)
  `;

  await bq.createQueryJob({ query }).then(j => j[0].promise());
}

function resolveStatus(stateObj, statusInt) {
  if (stateObj === 'resolved') return 'resolved';
  if (stateObj === 'unresolved') return 'unresolved';
  if (stateObj === 'pending') return 'pending';
  
  if (statusInt === 2) return 'resolved';
  if (statusInt === 1) return 'unresolved';
  if (statusInt === 0) return 'pending';
  return 'unknown';
}

function normalizeChannelOrigin(originStr) {
  if (!originStr) return null;
  if (originStr === 'chat' || originStr === 'email') return originStr;
  
  // Format is usually urn:crisp.im:whatsapp:0
  if (originStr.startsWith('urn:crisp.im:')) {
    const parts = originStr.split(':');
    if (parts.length >= 3) {
      return parts[2]; // extracts whatsapp, facebook, instagram, etc.
    }
  }
  return originStr;
}

async function syncCrispConversations() {
  const startTime = Date.now();
  const options = parseArgs();
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  
  let state = await getSyncState(bq);
  let filterDateStart = START_OF_2026;

  if (options.full) {
    console.log("Modo: FULL (desde 2026-01-01)");
    filterDateStart = START_OF_2026;
  } else if (options.sinceDate) {
    console.log(`Modo: SINCE (${options.sinceDate})`);
    filterDateStart = new Date(options.sinceDate).toISOString();
  } else if (state && state.last_processed_at) {
    // Restamos 24h por seguridad para capturar posibles actualizaciones retrasadas
    const checkpoint = new Date(state.last_processed_at.value);
    checkpoint.setHours(checkpoint.getHours() - 24);
    filterDateStart = checkpoint.toISOString();
    console.log(`Modo: INCREMENTAL (desde checkpoint: ${filterDateStart})`);
  } else {
    console.log("No hay checkpoint previo. Forzando modo FULL.");
    filterDateStart = START_OF_2026;
  }

  console.log("=== SYNC CRISP CONVERSATIONS ===");

  let page = 1;
  const toInsert = [];
  const seenIds = new Set();
  
  let latestUpdatedAt = state ? (state.last_processed_at ? state.last_processed_at.value : START_OF_2026) : START_OF_2026;
  let latestSessionId = state ? state.last_session_id : null;

  try {
    while (true) {
      const response = await crispApi.listConversations(page, { filter_date_start: filterDateStart });
      
      if (!response || !response.data || response.data.length === 0) {
        console.log(`\nFin natural alcanzado en la página ${page} (0 resultados).`);
        break;
      }

      for (const conv of response.data) {
        if (!seenIds.has(conv.session_id)) {
          seenIds.add(conv.session_id);
          
          let ratingValue = null;
          let ratingComment = null;
          if (conv.meta && conv.meta.data && conv.meta.data.rating) {
            ratingValue = conv.meta.data.rating.value;
            ratingComment = conv.meta.data.rating.comment;
          }

          toInsert.push({
            session_id: conv.session_id,
            created_at: new Date(conv.created_at).toISOString().replace('Z', ''),
            updated_at: new Date(conv.updated_at).toISOString().replace('Z', ''),
            status: resolveStatus(conv.state, conv.status),
            segments: conv.meta && conv.meta.segments ? conv.meta.segments.join(',') : null,
            rating_value: ratingValue,
            rating_comment: ratingComment,
            people_id: conv.people_id || null,
            channel_origin: normalizeChannelOrigin(conv.meta?.origin),
            visitor_nickname: conv.meta?.nickname || null,
            visitor_email: conv.meta?.email || null,
            visitor_phone: conv.meta?.phone || null
          });

          // Track latest event for checkpoint
          if (new Date(conv.updated_at) > new Date(latestUpdatedAt)) {
            latestUpdatedAt = new Date(conv.updated_at).toISOString().replace('Z', '');
            latestSessionId = conv.session_id;
          }
        }
      }

      process.stdout.write(`\rProcesando página ${page}... acumuladas: ${seenIds.size}`);
      page++;
      // Esperamos para no saturar
      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`\nExtracción finalizada. Total a insertar/actualizar: ${toInsert.length}`);

    if (toInsert.length > 0) {
      const timestamp = Date.now();
      const stagingTable = `crisp_conversations_staging_${timestamp}`;
      
      console.log('Cargando NDJSON a tabla staging...');
      await writeNdjsonAndLoad(bq, stagingTable, 'crisp_conversations', toInsert);
      
      console.log('Ejecutando MERGE upsert...');
      await runMerge(bq, stagingTable, 'crisp_conversations');
      
      console.log('Limpiando staging...');
      await bq.dataset(DATASET_ID).table(stagingTable).delete();
    }

    const totalProcessed = (state ? state.records_processed : 0) + toInsert.length;
    await updateSyncState(bq, {
      lastProcessedAt: latestUpdatedAt,
      lastSessionId: latestSessionId,
      recordsProcessed: totalProcessed,
      lastRunStatus: 'success'
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Sincronización completada en ${elapsed}s.`);

  } catch (err) {
    console.error("\n❌ Error durante la sincronización:", err.message);
    await updateSyncState(bq, {
      lastProcessedAt: latestUpdatedAt,
      lastSessionId: latestSessionId,
      recordsProcessed: state ? state.records_processed : 0,
      lastRunStatus: 'failed',
      lastRunError: err.message
    });
    process.exit(1);
  }
}

syncCrispConversations();
