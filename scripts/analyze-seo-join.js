require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function analyze() {
  console.log("--- 1. Analizando URLs en gsc_metrics ---");
  try {
    const [gscRows] = await bigquery.query({
      query: `SELECT page, SUM(impressions) as imp 
              FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` 
              WHERE page LIKE '%/products/%' 
              GROUP BY page 
              ORDER BY imp DESC 
              LIMIT 5`
    });
    console.log("Top URLs en GSC:");
    console.table(gscRows);
  } catch(e) { console.error(e) }

  console.log("\n--- 2. Analizando handles en shopify_products ---");
  try {
    const [prodRows] = await bigquery.query({
      query: `SELECT id, title, handle 
              FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\` 
              WHERE title LIKE '%Mac Mini%' OR title LIKE '%Honor Magic%'
              LIMIT 5`
    });
    console.log("Productos Shopify:");
    console.table(prodRows);
  } catch(e) { console.error(e) }

  console.log("\n--- 3. Analizando shopify_order_lines product_id vs shopify_products id ---");
  try {
    const [joinRows] = await bigquery.query({
      query: `SELECT L.product_id, L.title, P.id as joined_id, P.handle
              FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_order_lines\` L
              LEFT JOIN \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\` P
                ON L.product_id = P.id
              WHERE L.title LIKE '%Mac Mini%' OR L.title LIKE '%Honor Magic%'
              LIMIT 5`
    });
    console.log("Cruce Order Lines con Products:");
    console.table(joinRows);
  } catch(e) { console.error(e) }
}

analyze();
