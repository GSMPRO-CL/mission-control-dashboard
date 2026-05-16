const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function applyView() {
  console.log("Aplicando vista de Ventas Resumen Daily Summary en BigQuery...");
  try {
    const filePath = path.join(__dirname, 'sql', 'views', 'v_ventas_daily_summary.sql');
    let query = fs.readFileSync(filePath, 'utf8');
    
    // Remplazar el placeholder del proyecto con el proyecto real del .env
    const projectId = process.env.GCP_PROJECT_ID;
    query = query.replace(/\{project\}/g, projectId);

    const [job] = await bigquery.createQueryJob({ query });
    await job.promise();

    console.log("✅ Vista `v_ventas_daily_summary` creada/actualizada exitosamente.");
  } catch (error) {
    console.error("❌ Error al aplicar vista:", error);
  }
}

applyView();
