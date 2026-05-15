require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
const query = fs.readFileSync(__dirname + '/sql/ecommerce_data.crisp_sync_state.sql', 'utf8');

async function run() {
  console.log("Applying DDL...");
  const [job] = await bq.createQueryJob({ query });
  await job.promise();
  console.log("DDL applied successfully.");
}

run().catch(console.error);
