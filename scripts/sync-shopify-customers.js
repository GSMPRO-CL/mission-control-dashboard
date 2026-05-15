require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const { shopifyGraphQL } = require('./lib/shopify-graphql.js');

const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'shopify_customers';

const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  
  const schema = [
    { name: 'id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'updated_at', type: 'TIMESTAMP' },
    { name: 'state', type: 'STRING' },
    { name: 'city', type: 'STRING' },
    { name: 'province', type: 'STRING' },
    { name: 'country', type: 'STRING' },
    { name: 'zip', type: 'STRING' },
    { name: 'orders_count', type: 'INTEGER' },
    { name: 'total_spent', type: 'FLOAT' },
    { name: 'currency', type: 'STRING' }
  ];

  const table = dataset.table(TABLE_ID);
  const [exists] = await table.exists();
  if (!exists) {
    console.log(`Creando tabla ${TABLE_ID}...`);
    await dataset.createTable(TABLE_ID, { schema });
  } else {
    console.log(`Limpiando tabla ${TABLE_ID} para carga histórica...`);
    try {
      await bq.query(`TRUNCATE TABLE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``);
    } catch(e) {}
  }

  return table;
}

async function fetchShopifyCustomers() {
  let allCustomers = [];
  let hasNextPage = true;
  let endCursor = null;
  
  console.log(`Extrayendo clientes de Shopify...`);

  while (hasNextPage) {
    const afterParam = endCursor ? `, after: "${endCursor}"` : '';
    const query = `
      query {
        customers(first: 250${afterParam}) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            createdAt
            updatedAt
            state
            numberOfOrders
            amountSpent {
              amount
              currencyCode
            }
            defaultAddress {
              city
              province
              country
              zip
            }
          }
        }
      }
    `;

    try {
      const res = await shopifyGraphQL(query);
      if (!res || !res.customers) {
        throw new Error("No se pudo obtener datos de clientes de Shopify.");
      }

      const nodes = res.customers.nodes;
      
      // Filtrar clientes creados desde 2026 o con órdenes
      const validCustomers = nodes; // Vamos a extraer todos por ahora para tener la geografía completa

      allCustomers = allCustomers.concat(validCustomers);
      
      hasNextPage = res.customers.pageInfo.hasNextPage;
      endCursor = res.customers.pageInfo.endCursor;

      process.stdout.write(`\rDescargados: ${allCustomers.length} clientes...`);

    } catch (err) {
      console.error("\nError GraphQL:", err.message);
      break;
    }
  }

  console.log(`\nExtracción completada. Total: ${allCustomers.length} clientes obtenidos.`);
  return allCustomers;
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN SHOPIFY CUSTOMERS -> BIGQUERY ===");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const bqTable = await setupBigQuery(bigquery);

    const customers = await fetchShopifyCustomers();

    if (customers.length === 0) {
      console.log("No hay clientes para insertar.");
      return;
    }

    const bqRows = customers.map(c => {
      const numericId = c.id.split('/').pop();
      return {
        id: numericId,
        created_at: bigquery.datetime(new Date(c.createdAt).toISOString()),
        updated_at: bigquery.datetime(new Date(c.updatedAt).toISOString()),
        state: c.state || 'UNKNOWN',
        city: c.defaultAddress?.city || null,
        province: c.defaultAddress?.province || null,
        country: c.defaultAddress?.country || null,
        zip: c.defaultAddress?.zip || null,
        orders_count: parseInt(c.numberOfOrders || 0, 10),
        total_spent: parseFloat(c.amountSpent?.amount || 0),
        currency: c.amountSpent?.currencyCode || 'CLP'
      };
    });

    console.log("\nInsertando en BigQuery...");
    
    const chunkSize = 500;
    for (let i = 0; i < bqRows.length; i += chunkSize) {
      await bqTable.insert(bqRows.slice(i, i + chunkSize));
    }
    
    console.log(`✅ ${bqRows.length} clientes insertados en ${TABLE_ID}.`);

  } catch (err) {
    console.error("❌ Error en sincronización:", err);
  }
}

runSync();
