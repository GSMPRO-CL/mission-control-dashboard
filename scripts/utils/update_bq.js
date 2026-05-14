const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config({ path: './dashboard/.env.local' });

async function run() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });
  const query = `
    ALTER TABLE \`atomic-box-494614-r5.raw_layer.market_intelligence_launches\`
    ADD COLUMN IF NOT EXISTS fecha_lanzamiento DATE;
  `;
  try {
    console.log("Ejecutando ALTER TABLE...");
    const [job] = await bq.createQueryJob({ query });
    console.log(`Job ${job.id} started.`);
    await job.getQueryResults();
    console.log("Columna agregada exitosamente.");
  } catch (error) {
    console.error("Error ejecutando DDL:", error.message);
  }
}

run();
