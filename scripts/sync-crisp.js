/**
 * @deprecated Use sync-crisp-v2.js --full instead.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();
const MAX_EMPTY_PAGES = 5; // Si vemos 5 páginas seguidas sin tickets de 2026, detenemos

async function fetchCrispConversations() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  const args = process.argv.slice(2);
  let startPage = 1;
  let endPage = Infinity;
  
  args.forEach((arg, index) => {
    if (arg === '--start-page' && args[index + 1]) startPage = parseInt(args[index + 1]);
    if (arg === '--end-page' && args[index + 1]) endPage = parseInt(args[index + 1]);
  });

  let allConversations = [];
  let page = startPage;
  let emptyPagesCount = 0;

  console.log(`Extrayendo histórico de Crisp.chat desde 2026-01-01 (Tramo: Págs ${startPage} a ${endPage === Infinity ? 'Final' : endPage})...`);

  while (true) {
    if (page > endPage) {
      console.log(`\nAlcanzado el fin del tramo programado (Página ${endPage}). Deteniendo extracción.`);
      break;
    }
    let res;
    let retries = 20; // Aumentar cantidad de reintentos
    let delay = 5000; // Demora base

    // Manejo de Rate Limit
    while (retries > 0) {
      res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Crisp-Tier': 'plugin'
        }
      });

      if (res.status === 429) {
        let waitTime = delay;
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter) {
           waitTime = parseInt(retryAfter) * 1000;
        }

        process.stdout.write(`\n[Rate Limit 429] Esperando ${waitTime/1000} segundos para reintentar... (Quedan ${retries-1} intentos)\n`);
        await new Promise(r => setTimeout(r, waitTime));
        
        // Exponential backoff si no hay cabecera explícita
        if (!retryAfter) delay *= 2; 
        
        retries--;
      } else {
        break; // Éxito o error distinto de 429
      }
    }

    if (!res || !res.ok) {
      if (res && res.status === 404) break; // No hay más páginas
      throw new Error(`Crisp Error: ${res ? res.status + ' ' + res.statusText : 'Fallaron los reintentos por 429'}`);
    }

    const json = await res.json();
    const conversations = json.data;

    if (!conversations || conversations.length === 0) {
      break; // Fin de datos
    }

    // Filtramos las de 2026
    const validConversations = conversations.filter(c => c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS);
    
    // Si no hubo ninguna de 2026 en esta página, incrementamos el contador
    if (validConversations.length === 0) {
      emptyPagesCount++;
    } else {
      emptyPagesCount = 0; // Reset si encontramos algo útil
    }

    // Agregar sin duplicar
    validConversations.forEach(vc => {
      if (!allConversations.find(existing => existing.session_id === vc.session_id)) {
        allConversations.push(vc);
      }
    });

    process.stdout.write(`\rPág ${page} | Total acumulado de 2026: ${allConversations.length} conversaciones...`);

    // Detener de forma segura
    if (emptyPagesCount >= MAX_EMPTY_PAGES) {
      console.log(`\n\nSe detectaron ${MAX_EMPTY_PAGES} páginas seguidas sin conversaciones de 2026. Deteniendo paginación de forma segura.`);
      break;
    }

    page++;
    // Pausa preventiva para no saturar la API (200ms)
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nExtracción completada. Total final: ${allConversations.length} conversaciones del año 2026.`);
  return allConversations;
}

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  
  const schema = [
    { name: 'session_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP' },
    { name: 'status', type: 'STRING' },
    { name: 'segments', type: 'STRING' },
    { name: 'rating_value', type: 'INT64' },
    { name: 'rating_comment', type: 'STRING' }
  ];

  const table = dataset.table('crisp_conversations');
  const [exists] = await table.exists();
  if (!exists) {
    console.log("Creando tabla crisp_conversations...");
    await dataset.createTable('crisp_conversations', { schema });
  } else {
    console.log("Limpiando tabla crisp_conversations para carga histórica...");
    try {
      await bq.query(`TRUNCATE TABLE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_conversations\``);
    } catch(e) {}
  }

  return table;
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN CRISP.CHAT -> BIGQUERY (Histórico 2026) ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    
    const conversations = await fetchCrispConversations();

    if (conversations.length === 0) {
      console.log("No hay conversaciones para insertar.");
      return;
    }

    const bqTable = await setupBigQuery(bigquery);

    // Transform Data
    const bqRows = conversations.map(c => {
      let rating_val = null;
      let rating_com = null;
      if (c.meta && c.meta.rating) {
        rating_val = c.meta.rating.value || null;
        rating_com = c.meta.rating.comment || null;
      }

      let statusStr = c.state;
      if (!statusStr && c.status !== undefined) {
        if (c.status === 2) statusStr = 'resolved';
        else if (c.status === 1) statusStr = 'unresolved';
        else if (c.status === 0) statusStr = 'pending';
      }

      return {
        session_id: c.session_id,
        created_at: bigquery.datetime(new Date(c.created_at).toISOString()),
        updated_at: bigquery.datetime(new Date(c.updated_at).toISOString()),
        status: statusStr || 'unknown',
        segments: (c.meta && c.meta.segments) ? c.meta.segments.join(',') : '',
        rating_value: rating_val,
        rating_comment: rating_com
      };
    });

    console.log("\nInsertando en BigQuery de forma masiva...");
    
    const chunkSize = 500;
    for (let i = 0; i < bqRows.length; i += chunkSize) {
      await bqTable.insert(bqRows.slice(i, i + chunkSize));
    }
    
    console.log(`✅ ${bqRows.length} conversaciones insertadas en crisp_conversations.`);
    console.log("\nCarga Histórica Completada con Éxito.");

  } catch (err) {
    console.error("❌ Error en sincronización Crisp:", err);
  }
}

runSync();
