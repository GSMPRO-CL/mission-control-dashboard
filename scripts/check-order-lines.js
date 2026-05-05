require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function check() {
  const [rows] = await bigquery.query({
    query: `SELECT id, order_id, product_id, title, vendor
            FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_order_lines\`
            WHERE title LIKE '%Mac Mini%'
            LIMIT 10`
  });
  console.log("Order Lines for Mac Mini:");
  console.table(rows);
}
check();
