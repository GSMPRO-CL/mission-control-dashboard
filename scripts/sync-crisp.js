require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function fetchCrispConversations() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let allConversations = [];

  const filters = ['filter_not_resolved=1', 'filter_resolved=1'];

  console.log("Extrayendo histórico de Crisp.chat desde 2026-01-01...");

  for (const filter of filters) {
    let page = 1;
    let keepFetching = true;
    console.log(`\nAplicando filtro: ${filter}`);

    while (keepFetching) {
      const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}?${filter}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Crisp-Tier': 'plugin'
        }
      });

      if (!res.ok) {
        if (res.status === 404) {
          break;
        }
        throw new Error(`Crisp Error: ${res.statusText}`);
      }

      const json = await res.json();
      const conversations = json.data;

      if (!conversations || conversations.length === 0) {
        break;
      }

      const validConversations = conversations.filter(c => c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS);
      
      // Asegurarnos de no duplicar por seguridad, aunque sean disjoint sets
      validConversations.forEach(vc => {
        if (!allConversations.find(existing => existing.session_id === vc.session_id)) {
          allConversations.push(vc);
        }
      });

      process.stdout.write(`\rTotal acumulado: ${allConversations.length} conversaciones...`);

      const oldestInPage = conversations[conversations.length - 1];
      if (oldestInPage.updated_at < START_DATE_MS) {
        keepFetching = false;
      } else {
        page++;
      }
    }
  }

  console.log(`\nExtracción completada. Total: ${allConversations.length} conversaciones del año 2026.`);
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

      return {
        session_id: c.session_id,
        // Convertir milisegundos de Crisp a objeto Date para BigQuery
        created_at: bigquery.datetime(new Date(c.created_at).toISOString()),
        updated_at: bigquery.datetime(new Date(c.updated_at).toISOString()),
        status: c.state || c.status || 'unknown',
        segments: (c.meta && c.meta.segments) ? c.meta.segments.join(',') : '',
        rating_value: rating_val,
        rating_comment: rating_com
      };
    });

    console.log("Insertando en BigQuery de forma masiva...");
    
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
