require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
async function test() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const [rows] = await bq.query(`
    SELECT campaign_name, metric_name, SUM(count) as total
    FROM \`ecommerce_data.klaviyo_metrics\`
    WHERE campaign_name IS NOT NULL AND campaign_name != ''
    GROUP BY campaign_name, metric_name
  `);
  console.log("Campaigns metrics:", rows);
}
test();
