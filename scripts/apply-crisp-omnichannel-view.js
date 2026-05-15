require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

async function applyView() {
  console.log("=== INICIANDO CREACIÓN DE VISTA: OMNICHANNEL DUPLICITY ===");
  try {
    const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    
    const ddlPath = path.join(__dirname, 'sql', 'views', 'v_crisp_omnichannel_duplicity.sql');
    let sql = fs.readFileSync(ddlPath, 'utf8');
    
    sql = sql.replace(/{project_id}/g, process.env.GCP_PROJECT_ID);

    console.log(`Aplicando script SQL: \n${sql}\n`);
    
    await bq.query(sql);
    
    console.log("✅ Vista v_crisp_omnichannel_duplicity creada exitosamente.");
  } catch (err) {
    console.error("❌ Error creando la vista:", err.message);
    process.exit(1);
  }
}

applyView();
