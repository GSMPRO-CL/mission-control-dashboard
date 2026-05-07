require('dotenv').config({path: '../.env'});
const { BigQuery } = require('@google-cloud/bigquery');
async function run() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  try {
    await bq.query(`ALTER TABLE \`${process.env.GCP_PROJECT_ID}.ecommerce_data.crisp_messages\` ADD COLUMN IF NOT EXISTS operator_name STRING;`);
    console.log("Columna agregada.");
  } catch(e) {
    console.log("Error o ya existe:", e.message);
  }
}
run().catch(console.error);
