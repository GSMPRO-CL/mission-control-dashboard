require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

async function applyDdl() {
  console.log("=== INICIANDO APLICACIÓN DE DDL: OMNICHANNEL CRISP ===");
  try {
    const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    
    const ddlPath = path.join(__dirname, 'sql', 'alter_crisp_omnichannel_columns.sql');
    let sql = fs.readFileSync(ddlPath, 'utf8');
    
    sql = sql.replace(/{project_id}/g, process.env.GCP_PROJECT_ID);

    console.log(`Aplicando script DDL: \n${sql}\n`);
    
    await bq.query(sql);
    
    console.log("✅ DDL aplicado exitosamente a la tabla crisp_conversations.");
  } catch (err) {
    console.error("❌ Error aplicando el DDL:", err.message);
    process.exit(1);
  }
}

applyDdl();
