require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { shopifyGraphQL } = require('./lib/shopify-graphql');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATASET_ID = 'raw_layer';
const SYNC_ID = 'audit_log_main';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    backfillDays: null,
    sinceDate: null,
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith('--backfill=')) {
      const val = arg.replace('--backfill=', '');
      if (val.endsWith('d')) {
        options.backfillDays = parseInt(val.slice(0, -1), 10);
      }
    } else if (arg.startsWith('--since=')) {
      options.sinceDate = arg.replace('--since=', '');
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function getSyncState(bq) {
  const query = `
    SELECT last_processed_at, last_event_id, events_processed
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.audit_log_sync_state\`
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
    MERGE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.audit_log_sync_state\` T
    USING (SELECT 
      @syncId as sync_id, 
      TIMESTAMP(@lastProcessedAt) as last_processed_at, 
      @lastEventId as last_event_id, 
      CURRENT_TIMESTAMP() as last_run_at, 
      @eventsProcessed as events_processed, 
      @lastRunStatus as last_run_status, 
      @lastRunError as last_run_error, 
      CURRENT_TIMESTAMP() as updated_at
    ) S
    ON T.sync_id = S.sync_id
    WHEN MATCHED THEN
      UPDATE SET 
        last_processed_at = S.last_processed_at,
        last_event_id = S.last_event_id,
        last_run_at = S.last_run_at,
        events_processed = S.events_processed,
        last_run_status = S.last_run_status,
        last_run_error = S.last_run_error,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (sync_id, last_processed_at, last_event_id, last_run_at, events_processed, last_run_status, last_run_error, updated_at)
      VALUES (S.sync_id, S.last_processed_at, S.last_event_id, S.last_run_at, S.events_processed, S.last_run_status, S.last_run_error, S.updated_at)
  `;
  
  const options = {
    query: query,
    params: {
      syncId: SYNC_ID,
      lastProcessedAt: state.lastProcessedAt,
      lastEventId: state.lastEventId || null,
      eventsProcessed: state.eventsProcessed || 0,
      lastRunStatus: state.lastRunStatus,
      lastRunError: state.lastRunError || null
    },
    types: {
      syncId: 'STRING',
      lastProcessedAt: 'STRING',
      lastEventId: 'STRING',
      eventsProcessed: 'INT64',
      lastRunStatus: 'STRING',
      lastRunError: 'STRING'
    }
  };
  
  await bq.createQueryJob(options).then(j => j[0].promise());
}

async function getStaffList(bq) {
  const query = `SELECT staff_id, first_name, last_name, email, CONCAT(first_name, ' ', last_name) as full_name FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\``;
  const [rows] = await bq.query({ query });
  return rows;
}

function determineWindow(options, state) {
  let fromDate = null;
  const now = new Date();

  if (options.backfillDays) {
    fromDate = new Date(now.getTime() - (options.backfillDays * 24 * 60 * 60 * 1000));
  } else if (options.sinceDate) {
    fromDate = new Date(options.sinceDate);
  } else if (state && state.last_processed_at) {
    fromDate = new Date(state.last_processed_at.value);
  } else {
    throw new Error("No hay estado de sync previo. Por favor usa --backfill=Nd o --since=YYYY-MM-DD para la corrida inicial.");
  }

  // Restar un par de horas por seguridad (superposición en zona horaria / retrasos)
  const safeFromDate = new Date(fromDate.getTime() - (2 * 60 * 60 * 1000));
  return safeFromDate.toISOString();
}

const QUERY_EVENTS = `
  query PullEvents($cursor: String, $query: String) {
    events(first: 100, sortKey: CREATED_AT, reverse: false, after: $cursor, query: $query) {
      edges {
        cursor
        node {
          id
          createdAt
          action
          message
          appTitle
          attributeToApp
          attributeToUser
          criticalAlert
          ... on BasicEvent {
            subjectType
            subjectId
          }
          ... on CommentEvent {
            author {
              id
              name
            }
            subject {
              __typename
              ... on Order { id name }
              ... on DraftOrder { id name }
              ... on Customer { id }
              ... on Company { id name }
            }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

function normalizeText(text) {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD') // Decompose accents
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9 ]/g, ' ') // Keep only alphanumeric and spaces
    .trim()
    .replace(/\s+/g, ' ');
}

function extractStaffId(node, staffList) {
  // Prioridad 0: Campo tipado author.id (CommentEvent)
  if (node.author && node.author.id) {
    return cleanId(node.author.id);
  }

  // 1. Intentar extraer del GID (staff_member_id)
  const gidMatch = node.id.match(/staff_member_id=(\d+)/);
  if (gidMatch) {
    return gidMatch[1];
  }

  if (!node.message) return null;

  const msgRaw = node.message;
  const msgNorm = normalizeText(msgRaw);
  
  // Extraer texto de TODAS las etiquetas <a>, ya que el autor suele ser el primero
  const aTagMatches = [...msgRaw.matchAll(/<a[^>]*>(.*?)<\/a>/g)];
  const extractedNamesNorm = aTagMatches.map(m => normalizeText(m[1]));

  for (const staff of staffList) {
    if (!staff.first_name || !staff.last_name) continue;

    const fn = normalizeText(staff.first_name);
    const ln = normalizeText(staff.last_name);
    const full = normalizeText(staff.full_name);

    // Prioridad 1: Coincidencia exacta del full_name en el mensaje o en etiquetas <a>
    if (full && (msgNorm.includes(full) || extractedNamesNorm.some(n => n.includes(full)))) {
      return staff.staff_id;
    }

    // Prioridad 2: Etiqueta <a> contiene tanto el first_name como el last_name
    if (extractedNamesNorm.some(n => n.includes(fn) && n.includes(ln))) {
      return staff.staff_id;
    }

    // Prioridad 3: El mensaje completo contiene el first_name y last_name como palabras completas
    const fnRegex = new RegExp('\\b' + fn + '\\b');
    const lnRegex = new RegExp('\\b' + ln + '\\b');
    
    if (fnRegex.test(msgNorm) && lnRegex.test(msgNorm)) {
      return staff.staff_id;
    }
    
    // Prioridad 4: Si el first_name es único/largo (>= 4 chars), búsqueda exacta en el autor (primer <a>)
    // Evita falsos positivos como cortar prefijos a 4 letras.
    if (fn.length >= 4 && extractedNamesNorm.length > 0) {
      if (fnRegex.test(extractedNamesNorm[0])) {
         return staff.staff_id;
      }
    }
  }

  return null;
}

function cleanId(gid) {
  if (!gid) return null;
  const parts = gid.split('?')[0].split('/');
  return parts[parts.length - 1];
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
    ON T.audit_id = S.audit_id
    WHEN NOT MATCHED THEN
      INSERT (audit_id, occurred_at, staff_id, staff_email, action, subject_type, subject_id, ip_address, user_agent, raw_payload, ingested_at)
      VALUES (S.audit_id, S.occurred_at, S.staff_id, S.staff_email, S.action, S.subject_type, S.subject_id, S.ip_address, S.user_agent, S.raw_payload, S.ingested_at)
  `;

  const [job] = await bq.createQueryJob({ query });
  const [result] = await job.promise();
  return result;
}

async function syncAuditLog() {
  const startTime = Date.now();
  const options = parseArgs();
  
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  
  let state = await getSyncState(bq);
  let fromDateIso;
  
  try {
    fromDateIso = determineWindow(options, state);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // Initialize state and load staff map
  const staffList = await getStaffList(bq);
  console.log('STAFF LIST:', staffList);

  console.log("=== SYNC AUDIT LOG ===");
  console.log(`Modo:                    ${options.dryRun ? '[DRY-RUN] ' : ''}${options.backfillDays ? 'backfill' : options.sinceDate ? 'since' : 'incremental'}`);
  console.log(`Ventana:                 ${fromDateIso} → Now`);

  let cursor = null;
  let hasNextPage = true;
  let eventsExtracted = 0;
  let humanEvents = 0;
  let appsSystemFiltered = 0;
  let withoutStaffId = 0;
  let totalGraphQLCost = 0;
  
  const toInsert = [];
  let lastProcessedAtStr = state ? (state.last_processed_at ? state.last_processed_at.value : null) : null;
  let lastEventIdStr = state ? state.last_event_id : null;

  const searchQuery = `created_at:>=${fromDateIso}`;

  try {
    while (hasNextPage) {
      const vars = { cursor, query: searchQuery };
      const res = await shopifyGraphQL(QUERY_EVENTS, vars);
      
      const pageInfo = res.events.pageInfo;
      const edges = res.events.edges;

      for (const edge of edges) {
        eventsExtracted++;
        const node = edge.node;

        if (node.attributeToUser === true) {
          humanEvents++;
          
          const staffId = extractStaffId(node, staffList);
          if (!staffId) withoutStaffId++;

          const auditId = cleanId(node.id);
          
          toInsert.push({
            audit_id: auditId,
            occurred_at: node.createdAt,
            staff_id: staffId,
            staff_email: null,
            action: node.action,
            subject_type: node.subjectType || (node.subject && node.subject.__typename) || 'N/A',
            subject_id: cleanId(node.subjectId) || (node.subject && cleanId(node.subject.id)) || 'N/A',
            ip_address: null,
            user_agent: null,
            raw_payload: JSON.stringify(node),
            ingested_at: new Date().toISOString()
          });

          // Track latest event for checkpoint
          if (!lastProcessedAtStr || new Date(node.createdAt) > new Date(lastProcessedAtStr)) {
            lastProcessedAtStr = node.createdAt;
            lastEventIdStr = node.id;
          }
        } else {
          appsSystemFiltered++;
        }
      }

      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      // Prevent memory bloat on huge backfills: write in batches of 5000 if not dry run
      // Actually we will collect all for now, but a robust system might batch. We'll batch in memory.
      if (options.dryRun && eventsExtracted >= 1000) {
        console.log("[DRY-RUN] Test limit reached (1000 events). Breaking loop.");
        break;
      }
    }

    let insertedCount = 0;
    let duplicateCount = 0;

    if (!options.dryRun) {
      if (toInsert.length > 0) {
        const timestamp = Date.now();
        const stagingTable = `shopify_audit_log_staging_${timestamp}`;
        
        await writeNdjsonAndLoad(bq, stagingTable, 'shopify_audit_log', toInsert);
        const mergeResult = await runMerge(bq, stagingTable, 'shopify_audit_log');
        
        await bq.dataset(DATASET_ID).table(stagingTable).delete();

        // Calculate inserted vs duplicates. The MERGE DML stats will tell us rows inserted.
        // Wait, bq API for DML stats requires fetching the job details.
        // For simplicity, we just say attempted vs unknown duplicates.
        insertedCount = toInsert.length; 
        duplicateCount = 0; // We can't easily get exact dupes without the DML stats.
      }

      const totalEventsProcessed = (state ? state.events_processed : 0) + eventsExtracted;
      await updateSyncState(bq, {
        lastProcessedAt: lastProcessedAtStr || new Date().toISOString(),
        lastEventId: lastEventIdStr,
        eventsProcessed: totalEventsProcessed,
        lastRunStatus: 'success',
        lastRunError: null
      });
    }

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    console.log(`Eventos extraídos:       ${eventsExtracted}`);
    console.log(`Eventos humanos:         ${humanEvents} (filtrados: ${appsSystemFiltered} apps/sistema)`);
    console.log(`Eventos sin staff_id:    ${withoutStaffId} (revisar)`);
    if (!options.dryRun) {
      console.log(`Eventos insertados:      ${insertedCount} intentados`);
    }
    console.log(`Tiempo total:            ${durationSeconds} segundos`);
    console.log(`Costo GraphQL total:     ${totalGraphQLCost} puntos`);
    console.log(`\nPróxima sync recomendada: Cada 6 horas.`);

  } catch (err) {
    console.error("\n❌ Error durante la sincronización:", err.message);
    if (!options.dryRun) {
      await updateSyncState(bq, {
        lastProcessedAt: lastProcessedAtStr || (state ? state.last_processed_at.value : new Date().toISOString()),
        lastEventId: lastEventIdStr || (state ? state.last_event_id : null),
        eventsProcessed: state ? state.events_processed : 0,
        lastRunStatus: 'failed',
        lastRunError: err.message
      });
    }
    process.exit(1);
  }
}

syncAuditLog();
