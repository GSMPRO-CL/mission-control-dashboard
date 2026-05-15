require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { shopifyGraphQL } = require('./lib/shopify-graphql.js');

const DATASET_ID = 'ecommerce_data';

// Determinamos si es una carga histórica completa o incremental (últimos 7 días)
const isHistorical = process.argv.includes('--historical');
const sinceDate = new Date();
if (isHistorical) {
  sinceDate.setFullYear(2026, 0, 1);
  sinceDate.setHours(0, 0, 0, 0);
  console.log("Modo: HISTÓRICO (Todo 2026)");
} else {
  sinceDate.setDate(sinceDate.getDate() - 7);
  console.log("Modo: INCREMENTAL (Últimos 7 días)");
}
const START_DATE = sinceDate.toISOString();

async function fetchAllShopifyOrders() {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;
  
  let allOrders = [];
  // Usamos updated_at_min para capturar órdenes nuevas o modificadas recientemente
  let url = `https://${domain}/admin/api/2024-01/orders.json?status=any&limit=250&updated_at_min=${START_DATE}`;

  console.log(`Extrayendo órdenes de Shopify desde ${START_DATE}...`);

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Error Shopify: ${res.statusText}`);
    }

    const data = await res.json();
    allOrders = allOrders.concat(data.orders);
    
    process.stdout.write(`\rDescargadas: ${allOrders.length} órdenes...`);

    // Pagination logic
    const linkHeader = res.headers.get('link');
    url = null;
    if (linkHeader) {
      const links = linkHeader.split(',');
      const nextLink = links.find(link => link.includes('rel="next"'));
      if (nextLink) {
        const match = nextLink.match(/<([^>]+)>/);
        if (match) {
          url = match[1];
        }
      }
    }
  }
  
  console.log(`\nExtracción completada. Total: ${allOrders.length} órdenes obtenidas.`);
  return allOrders;
}

function toBQDatetime(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toISOString().replace('Z', '');
}

async function fetchOrderMetafields(orderIds) {
  const map = {};
  const chunkSize = 100;
  
  console.log(`\nObteniendo metafields para ${orderIds.length} órdenes...`);
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize);
    const gids = chunk.map(id => `"gid://shopify/Order/${id}"`).join(', ');
    const query = `
      query {
        nodes(ids: [${gids}]) {
          ... on Order {
            id
            metafield(namespace: "custom", key: "estado_de_pedido") {
              value
            }
          }
        }
      }
    `;
    
    try {
      const res = await shopifyGraphQL(query);
      if (res && res.nodes) {
        res.nodes.forEach(node => {
          if (node && node.id) {
            const numericId = node.id.split('/').pop();
            let estado = null;
            if (node.metafield && node.metafield.value) {
              try {
                // value is something like '["14. No comprar..."]'
                const parsed = JSON.parse(node.metafield.value);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  estado = parsed[0];
                } else {
                  estado = node.metafield.value;
                }
              } catch (e) {
                estado = node.metafield.value;
              }
            }
            map[numericId] = estado;
          }
        });
      }
      process.stdout.write(`\rMetafields obtenidos: ${Math.min(i + chunkSize, orderIds.length)}/${orderIds.length}...`);
    } catch (err) {
      console.error(`\nError fetching metafields chunk:`, err);
    }
  }
  console.log("");
  return map;
}

async function writeNdjsonAndLoad(bq, dataset, tableName, stagingTableName, dataArray) {
  if (dataArray.length === 0) return;
  
  const tempFilePath = path.join(os.tmpdir(), `${stagingTableName}.ndjson`);
  const ndjsonContent = dataArray.map(obj => JSON.stringify(obj)).join('\n');
  fs.writeFileSync(tempFilePath, ndjsonContent);

  const stagingTable = dataset.table(stagingTableName);
  
  // Obtenemos el esquema de la tabla destino para la tabla temporal
  const targetTable = dataset.table(tableName);
  const [metadata] = await targetTable.getMetadata();
  const schema = metadata.schema;

  console.log(`Creando tabla staging ${stagingTableName}...`);
  await stagingTable.create({ schema });

  console.log(`Cargando datos en ${stagingTableName} (Load Job)...`);
  await stagingTable.load(tempFilePath, {
    sourceFormat: 'NEWLINE_DELIMITED_JSON'
  });

  fs.unlinkSync(tempFilePath);
}

async function runMerge(bq, stagingTableName, targetTableName, mergeType) {
  const projectId = process.env.GCP_PROJECT_ID;
  const targetPath = `\`${projectId}.${DATASET_ID}.${targetTableName}\``;
  const stagingPath = `\`${projectId}.${DATASET_ID}.${stagingTableName}\``;

  let query = "";
  if (mergeType === 'orders') {
    query = `
      MERGE ${targetPath} T
      USING ${stagingPath} S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET 
          order_number = S.order_number,
          updated_at = S.updated_at,
          total_price = S.total_price,
          subtotal_price = S.subtotal_price,
          total_discounts = S.total_discounts,
          financial_status = S.financial_status,
          fulfillment_status = S.fulfillment_status,
          currency = S.currency,
          estado_de_pedido = S.estado_de_pedido
      WHEN NOT MATCHED THEN
        INSERT (id, order_number, created_at, updated_at, total_price, subtotal_price, total_discounts, financial_status, fulfillment_status, currency, estado_de_pedido)
        VALUES (S.id, S.order_number, S.created_at, S.updated_at, S.total_price, S.subtotal_price, S.total_discounts, S.financial_status, S.fulfillment_status, S.currency, S.estado_de_pedido)
    `;
  } else if (mergeType === 'lines') {
    query = `
      MERGE ${targetPath} T
      USING ${stagingPath} S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET 
          title = S.title,
          vendor = S.vendor,
          quantity = S.quantity,
          price = S.price,
          product_id = S.product_id,
          variant_id = S.variant_id
      WHEN NOT MATCHED THEN
        INSERT (id, order_id, product_id, variant_id, title, vendor, quantity, price)
        VALUES (S.id, S.order_id, S.product_id, S.variant_id, S.title, S.vendor, S.quantity, S.price)
    `;
  }

  console.log(`Ejecutando MERGE para ${targetTableName}...`);
  const [job] = await bq.createQueryJob({ query });
  await job.promise();
  console.log(`✅ MERGE completado para ${targetTableName}.`);
}

async function runSync() {
  console.log("=== INICIANDO SINCRONIZACIÓN SHOPIFY -> BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const dataset = bigquery.dataset(DATASET_ID);
    
    // Fetch data
    const orders = await fetchAllShopifyOrders();

    if (orders.length === 0) {
      console.log("No hay órdenes nuevas o modificadas para procesar.");
      return;
    }

    // Fetch metafields via GraphQL
    const orderIds = orders.map(o => o.id);
    const metafieldsMap = await fetchOrderMetafields(orderIds);

    // Transform Data
    const bqOrders = orders.map(o => ({
      id: o.id,
      order_number: o.order_number,
      created_at: toBQDatetime(o.created_at),
      updated_at: toBQDatetime(o.updated_at),
      total_price: parseFloat(o.total_price),
      subtotal_price: parseFloat(o.subtotal_price),
      total_discounts: parseFloat(o.total_discounts),
      financial_status: o.financial_status || 'unknown',
      fulfillment_status: o.fulfillment_status || 'unfulfilled',
      currency: o.currency,
      estado_de_pedido: metafieldsMap[o.id] || null
    }));

    const bqLines = [];
    orders.forEach(o => {
      o.line_items.forEach(item => {
        bqLines.push({
          id: item.id,
          order_id: o.id,
          product_id: item.product_id || null,
          variant_id: item.variant_id || null,
          title: item.title,
          vendor: item.vendor || null,
          quantity: item.quantity,
          price: parseFloat(item.price)
        });
      });
    });

    const timestamp = Date.now();
    const stagingOrdersTable = `shopify_orders_staging_${timestamp}`;
    const stagingLinesTable = `shopify_order_lines_staging_${timestamp}`;

    // Load data into staging tables
    await writeNdjsonAndLoad(bigquery, dataset, 'shopify_orders', stagingOrdersTable, bqOrders);
    await writeNdjsonAndLoad(bigquery, dataset, 'shopify_order_lines', stagingLinesTable, bqLines);

    // Ejecutar UPSERTs (MERGE)
    await runMerge(bigquery, stagingOrdersTable, 'shopify_orders', 'orders');
    await runMerge(bigquery, stagingLinesTable, 'shopify_order_lines', 'lines');

    // Clean up staging tables
    console.log("Limpiando tablas de staging...");
    await dataset.table(stagingOrdersTable).delete();
    await dataset.table(stagingLinesTable).delete();

    console.log("\n✅ Sincronización UPSERT Completada con Éxito.");
  } catch (err) {
    console.error("❌ Error durante la sincronización:", err);
  }
}

runSync();
