require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

async function testBigQuery() {
  console.log("=== VERIFICACIÓN BIGQUERY (ADC) ===\n");
  try {
    // Si la máquina hizo "gcloud auth application-default login", esto tomará las credenciales automáticamente
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    
    // Intentaremos listar los datasets en el proyecto para validar acceso
    console.log("Intentando listar datasets en proyecto:", process.env.GCP_PROJECT_ID);
    const [datasets] = await bigquery.getDatasets();
    
    console.log("✅ Conexión a BigQuery Exitosa.");
    console.log(`Datasets encontrados: ${datasets.length}`);
    datasets.forEach(dataset => console.log(` - ${dataset.id}`));
  } catch (error) {
    console.log("❌ Error de Conexión a BigQuery:");
    console.log(error.message);
  }
}

testBigQuery();
