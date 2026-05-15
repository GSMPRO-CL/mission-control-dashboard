require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery }  = require('@google-cloud/bigquery');
const language      = require('@google-cloud/language');
const crypto        = require('crypto');
const fs            = require('fs');
const os            = require('os');
const path          = require('path');
const crispApi      = require('./lib/crisp-api');

const DATASET_ID  = 'ecommerce_data';
const SYNC_ID     = 'crisp_messages';
const BATCH_SIZE  = 50;  
const NLP_SLEEP_MS = 100;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
      lastProcessedAt: state.lastProcessedAt || new Date().toISOString(),
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
    ON T.message_id = S.message_id
    WHEN MATCHED AND T.sentiment_score IS NULL AND S.sentiment_score IS NOT NULL THEN
      UPDATE SET 
        sentiment_score = S.sentiment_score, 
        sentiment_magnitude = S.sentiment_magnitude
    WHEN MATCHED THEN 
      UPDATE SET 
        content = S.content,
        operator_name = S.operator_name
    WHEN NOT MATCHED THEN
      INSERT (message_id, session_id, created_at, sender_type, operator_name, content, sentiment_score, sentiment_magnitude)
      VALUES (S.message_id, S.session_id, S.created_at, S.sender_type, S.operator_name, S.content, S.sentiment_score, S.sentiment_magnitude)
  `;

  await bq.createQueryJob({ query }).then(j => j[0].promise());
}

async function upsertMessages(bigquery, rows) {
  if (rows.length === 0) return;
  const timestamp = Date.now();
  const stagingTableName = `crisp_messages_staging_${timestamp}`;

  await writeNdjsonAndLoad(bigquery, stagingTableName, 'crisp_messages', rows);
  await runMerge(bigquery, stagingTableName, 'crisp_messages');
  await bigquery.dataset(DATASET_ID).table(stagingTableName).delete();
}

async function markSessionsAsSynced(bq, sessionIds) {
  if (sessionIds.length === 0) return;
  const query = `
    UPDATE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_conversations\`
    SET messages_synced = TRUE
    WHERE session_id IN UNNEST(@sessionIds)
  `;
  await bq.createQueryJob({
    query,
    params: { sessionIds },
    types: { sessionIds: ['STRING'] }
  }).then(j => j[0].promise());
}

async function syncNewSessionMessages(bigquery, nlpClient) {
  const sentimentOnly = process.argv.includes('--sentiment-only');
  if (sentimentOnly) {
    console.log('Modo --sentiment-only: saltando fase de sesiones nuevas.');
    return 0;
  }

  const [sessions] = await bigquery.query(`
    SELECT session_id
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_conversations\`
    WHERE messages_synced IS NOT TRUE
    ORDER BY created_at
  `);

  if (sessions.length === 0) {
    console.log('Fase 1: No hay sesiones nuevas sin mensajes.');
    return 0;
  }

  console.log(`Fase 1: ${sessions.length} sesiones nuevas sin mensajes. Extrayendo...`);
  let total = 0;
  let rowsBatch = [];
  let syncedSessionsBatch = [];

  for (let i = 0; i < sessions.length; i++) {
    const sessionId = sessions[i].session_id;
    const response = await crispApi.listMessages(sessionId);
    const msgs = response && response.data ? response.data : [];
    
    syncedSessionsBatch.push(sessionId);

    for (const msg of msgs) {
      if (msg.type !== 'text') continue;
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const sender  = msg.from;
      let operator_name = null;
      if (sender === 'operator' && msg.user && msg.user.nickname) operator_name = msg.user.nickname;

      let sentiment_score = null, sentiment_magnitude = null;
      if (sender === 'user' && content.length > 3) {
        const s = await analyzeSentiment(nlpClient, content);
        sentiment_score     = s.score;
        sentiment_magnitude = s.magnitude;
        await sleep(NLP_SLEEP_MS);
      }

      rowsBatch.push({
        message_id:          String(msg.fingerprint || crypto.randomUUID()),
        session_id:          sessionId,
        created_at:          new Date(msg.timestamp).toISOString().replace('Z', ''),
        sender_type:         sender,
        operator_name,
        content,
        sentiment_score,
        sentiment_magnitude,
      });
    }

    if (syncedSessionsBatch.length >= 100 || i === sessions.length - 1) {
      if (rowsBatch.length > 0) {
         await upsertMessages(bigquery, rowsBatch);
         total += rowsBatch.length;
         rowsBatch = [];
      }
      if (syncedSessionsBatch.length > 0) {
         await markSessionsAsSynced(bigquery, syncedSessionsBatch);
         syncedSessionsBatch = [];
      }
    }

    process.stdout.write(`\r  Sesión ${i + 1}/${sessions.length} | Mensajes procesados: ${total}`);
    await sleep(1000);
  }

  console.log(`\nFase 1 completada: ${total} mensajes insertados.`);
  return total;
}

async function fillMissingSentiment(bigquery, nlpClient) {
  const [pending] = await bigquery.query(`
    SELECT message_id, content
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_messages\`
    WHERE sender_type = 'user'
      AND sentiment_score IS NULL
      AND content IS NOT NULL
      AND LENGTH(content) > 3
    ORDER BY created_at
    LIMIT 1000
  `);

  if (pending.length === 0) {
    console.log('Fase 2: No hay mensajes con sentiment_score pendiente.');
    return 0;
  }

  console.log(`\nFase 2: ${pending.length} mensajes sin sentiment_score. Procesando en batches de ${BATCH_SIZE}...`);
  let updated = 0;
  let rowsBatch = [];

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i];
    const s = await analyzeSentiment(nlpClient, row.content);
    if (s.score !== null) {
      rowsBatch.push({
        message_id:          row.message_id,
        session_id:          'DUMMY', // Will be ignored by MERGE due to the query logic
        created_at:          new Date().toISOString().replace('Z', ''),
        sender_type:         'user',
        operator_name:       null,
        content:             row.content,
        sentiment_score:     s.score,
        sentiment_magnitude: s.magnitude,
      });
    }
    await sleep(NLP_SLEEP_MS);

    if (rowsBatch.length >= BATCH_SIZE || i === pending.length - 1) {
      if (rowsBatch.length > 0) {
        await upsertMessages(bigquery, rowsBatch);
        updated += rowsBatch.length;
        rowsBatch = [];
      }
    }
    
    if (i % 10 === 0 || i === pending.length - 1) {
      process.stdout.write(`\r  Procesados: ${i + 1}/${pending.length} | Actualizados: ${updated}`);
    }
  }

  console.log(`\nFase 2 completada: ${updated} mensajes enriquecidos con NLP.`);
  return updated;
}

async function run() {
  console.log('=== SYNC CRISP MENSAJES (INCREMENTAL + NLP) ===\n');
  const bigquery  = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  let state = await getSyncState(bigquery);
  
  try {
    const nlpClient = new language.LanguageServiceClient();

    const f1 = await syncNewSessionMessages(bigquery, nlpClient);
    const f2 = await fillMissingSentiment(bigquery, nlpClient);

    const totalProcessed = (state ? state.records_processed : 0) + f1 + f2;
    await updateSyncState(bigquery, {
      lastProcessedAt: new Date().toISOString(),
      lastSessionId: null,
      recordsProcessed: totalProcessed,
      lastRunStatus: 'success'
    });

    console.log(`\n=== COMPLETADO ✅ | Mensajes nuevos: ${f1} | NLP rellenados: ${f2} ===`);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    await updateSyncState(bigquery, {
      lastProcessedAt: state ? state.last_processed_at.value : new Date().toISOString(),
      lastSessionId: state ? state.last_session_id : null,
      recordsProcessed: state ? state.records_processed : 0,
      lastRunStatus: 'failed',
      lastRunError: err.message
    });
    process.exit(1);
  }
}

run();
