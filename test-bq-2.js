const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

async function run() {
  const query = `
    SELECT financial_status, fulfillment_status, COUNT(*) as count
    FROM \`ecommerce_data.shopify_orders\`
    WHERE estado_de_pedido LIKE '0. %' OR estado_de_pedido LIKE '1. %' OR estado_de_pedido LIKE '2. %'
    GROUP BY financial_status, fulfillment_status
  `;
  const [rows] = await bigquery.query({ query });
  console.log(JSON.stringify(rows, null, 2));
}
run().catch(console.error);
