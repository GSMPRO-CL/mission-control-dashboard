require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'gsc_metrics';

async function createGSCTable() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error("GCP_PROJECT_ID no está definido en .env");
    }

    const bigquery = new BigQuery({ projectId });
    const dataset = bigquery.dataset(DATASET_ID);

    const schema = [
      { name: 'id', type: 'STRING', mode: 'REQUIRED', description: 'MD5 hash of date+property+page+query for deduplication' },
      { name: 'date', type: 'DATE', mode: 'REQUIRED' },
      { name: 'property', type: 'STRING', mode: 'REQUIRED' },
      { name: 'page', type: 'STRING', mode: 'NULLABLE' },
      { name: 'query', type: 'STRING', mode: 'NULLABLE' },
      { name: 'clicks', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'impressions', type: 'INTEGER', mode: 'NULLABLE' },
      { name: 'ctr', type: 'FLOAT', mode: 'NULLABLE' },
      { name: 'position', type: 'FLOAT', mode: 'NULLABLE' }
    ];

    const options = {
      schema: schema,
      location: 'US', // O ajusta según tu configuración de BigQuery
      timePartitioning: {
        type: 'DAY',
        field: 'date',
      },
    };

    console.log(`Verificando existencia de la tabla ${TABLE_ID}...`);
    const table = dataset.table(TABLE_ID);
    const [exists] = await table.exists();

    if (exists) {
      console.log(`La tabla ${TABLE_ID} ya existe. Abortando creación.`);
      return;
    }

    console.log(`Creando tabla ${TABLE_ID}...`);
    await dataset.createTable(TABLE_ID, options);
    console.log(`✅ Tabla ${TABLE_ID} creada exitosamente en el dataset ${DATASET_ID}.`);

  } catch (error) {
    console.error("❌ Error al crear la tabla GSC:", error);
  }
}

createGSCTable();
