require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

async function applyDDL() {
  console.log("=== INICIANDO APLICACIÓN DE DDL PARA CALENDARIO COMERCIAL ===\n");
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) throw new Error("Missing GCP_PROJECT_ID");
    const bigquery = new BigQuery({ projectId });
    
    const filePath = path.join(__dirname, 'sql', 'raw_layer.commercial_calendar.sql');
    const query = fs.readFileSync(filePath, 'utf8');
    console.log(`Ejecutando raw_layer.commercial_calendar.sql...`);
    
    const [job] = await bigquery.createQueryJob({ query, location: 'US' });
    await job.promise();
    console.log(`✅ Ejecutado exitosamente.`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

applyDDL();
