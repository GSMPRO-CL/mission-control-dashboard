require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'sql', 'raw_layer.shopify_traffic_daily.sql'), 'utf8');
  try {
    console.log("Applying DDL for Traffic...");
    const [job] = await bigquery.createQueryJob({ query: sql });
    await job.promise();
    console.log("✅ DDL applied successfully.");
  } catch (error) {
    console.error("❌ Error applying DDL:", error.message);
  }
}

run();
