require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
async function test() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const [rows] = await bq.query(`
    SELECT flow_name, SUM(sum_value) as rev, SUM(count) as ord
    FROM \`ecommerce_data.klaviyo_metrics\`
    WHERE metric_name = 'Placed Order' AND flow_name IS NOT NULL AND flow_name != ''
    GROUP BY flow_name
  `);
  console.log("Flows:", rows);
  
  const [rows2] = await bq.query(`
    SELECT campaign_name, SUM(sum_value) as rev, SUM(count) as ord
    FROM \`ecommerce_data.klaviyo_metrics\`
    WHERE metric_name = 'Placed Order' AND campaign_name IS NOT NULL AND campaign_name != ''
    GROUP BY campaign_name
  `);
  console.log("Campaigns:", rows2);
}
test();
