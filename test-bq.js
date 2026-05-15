const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

async function run() {
  const query = `
    SELECT created_at, financial_status, fulfillment_status
    FROM \`ecommerce_data.shopify_orders\`
    LIMIT 1
  `;
  const [rows] = await bigquery.query({ query });
  console.log(JSON.stringify(rows[0], null, 2));
}
run().catch(console.error);
