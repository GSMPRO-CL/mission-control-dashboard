require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATASET_ID = 'ecommerce_data';

// Determinamos si es una carga histórica completa o incremental (últimos 7 días)
const isHistorical = process.argv.includes('--historical');
const sinceDate = new Date();
if (isHistorical) {
  sinceDate.setFullYear(2020, 0, 1); // Extract everything from the beginning essentially
  sinceDate.setHours(0, 0, 0, 0);
  console.log("Modo: HISTÓRICO (Todo el catálogo)");
} else {
  sinceDate.setDate(sinceDate.getDate() - 7);
  console.log("Modo: INCREMENTAL (Últimos 7 días)");
}
const START_DATE = sinceDate.toISOString();

async function fetchAllShopifyProducts() {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;
  
  let allProducts = [];
  let url = `https://${domain}/admin/api/2024-01/products.json?limit=250&updated_at_min=${START_DATE}`;

  console.log(`Extrayendo productos de Shopify desde ${START_DATE}...`);

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
    allProducts = allProducts.concat(data.products);
    
    process.stdout.write(`\rDescargados: ${allProducts.length} productos...`);

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
  
  console.log(`\nExtracción completada. Total: ${allProducts.length} productos obtenidos.`);
  return allProducts;
}

function toBQDatetime(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toISOString().replace('Z', '');
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
  if (mergeType === 'products') {
    query = `
      MERGE ${targetPath} T
      USING ${stagingPath} S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET 
          title = S.title,
          vendor = S.vendor,
          product_type = S.product_type,
          status = S.status,
          handle = S.handle,
          updated_at = S.updated_at,
          published_at = S.published_at
      WHEN NOT MATCHED THEN
        INSERT (id, title, vendor, product_type, status, handle, created_at, updated_at, published_at)
        VALUES (S.id, S.title, S.vendor, S.product_type, S.status, S.handle, S.created_at, S.updated_at, S.published_at)
    `;
  } else if (mergeType === 'variants') {
    query = `
      MERGE ${targetPath} T
      USING ${stagingPath} S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET 
          title = S.title,
          price = S.price,
          sku = S.sku,
          inventory_quantity = S.inventory_quantity,
          updated_at = S.updated_at
      WHEN NOT MATCHED THEN
        INSERT (id, product_id, title, price, sku, inventory_quantity, created_at, updated_at)
        VALUES (S.id, S.product_id, S.title, S.price, S.sku, S.inventory_quantity, S.created_at, S.updated_at)
    `;
  }

  console.log(`Ejecutando MERGE para ${targetTableName}...`);
  const [job] = await bq.createQueryJob({ query });
  await job.promise();
  console.log(`✅ MERGE completado para ${targetTableName}.`);
}

async function runSync() {
  console.log("=== INICIANDO SINCRONIZACIÓN PRODUCTOS SHOPIFY -> BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const dataset = bigquery.dataset(DATASET_ID);
    
    // Fetch data
    const products = await fetchAllShopifyProducts();

    if (products.length === 0) {
      console.log("No hay productos nuevos o modificados para procesar.");
      return;
    }

    // Transform Data
    const bqProducts = products.map(p => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor || null,
      product_type: p.product_type || null,
      status: p.status || 'unknown',
      handle: p.handle || null,
      created_at: toBQDatetime(p.created_at),
      updated_at: toBQDatetime(p.updated_at),
      published_at: toBQDatetime(p.published_at)
    }));

    const bqVariants = [];
    products.forEach(p => {
      if (p.variants) {
        p.variants.forEach(variant => {
          bqVariants.push({
            id: variant.id,
            product_id: p.id,
            title: variant.title,
            price: parseFloat(variant.price) || 0,
            sku: variant.sku || null,
            inventory_quantity: variant.inventory_quantity || 0,
            created_at: toBQDatetime(variant.created_at),
            updated_at: toBQDatetime(variant.updated_at)
          });
        });
      }
    });

    const timestamp = Date.now();
    const stagingProductsTable = `shopify_products_staging_${timestamp}`;
    const stagingVariantsTable = `shopify_product_variants_staging_${timestamp}`;

    // Load data into staging tables
    await writeNdjsonAndLoad(bigquery, dataset, 'shopify_products', stagingProductsTable, bqProducts);
    await writeNdjsonAndLoad(bigquery, dataset, 'shopify_product_variants', stagingVariantsTable, bqVariants);

    // Ejecutar UPSERTs (MERGE)
    await runMerge(bigquery, stagingProductsTable, 'shopify_products', 'products');
    await runMerge(bigquery, stagingVariantsTable, 'shopify_product_variants', 'variants');

    // Clean up staging tables
    console.log("Limpiando tablas de staging...");
    await dataset.table(stagingProductsTable).delete();
    await dataset.table(stagingVariantsTable).delete();

    console.log("\n✅ Sincronización de Productos Completada con Éxito.");
  } catch (err) {
    console.error("❌ Error durante la sincronización:", err);
  }
}

runSync();
