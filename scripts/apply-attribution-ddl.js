require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

async function applyDDL() {
  console.log("=== INICIANDO APLICACIÓN DE DDL PARA MÓDULO DE ATRIBUCIÓN ===\n");
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error("Missing GCP_PROJECT_ID in environment variables.");
    }

    const bigquery = new BigQuery({ projectId });
    const location = 'US';

    const datasets = ['raw_layer', 'marts_layer'];

    for (const datasetId of datasets) {
      const dataset = bigquery.dataset(datasetId);
      const [exists] = await dataset.exists();
      if (!exists) {
        console.log(`Creando dataset ${datasetId} en region ${location}...`);
        await bigquery.createDataset(datasetId, { location });
        console.log(`✅ Dataset ${datasetId} creado exitosamente.`);
      } else {
        console.log(`✅ Dataset ${datasetId} ya existe.`);
      }
    }

    const ddlFiles = [
      'raw_layer.shopify_staff.sql',
      'raw_layer.shopify_audit_log.sql',
      'raw_layer.shopify_snapshots.sql',
      'raw_layer.staff_assignments.sql',
      'marts_layer.activity_log.sql',
      'raw_layer.audit_log_sync_state.sql'
    ];

    console.log("\n=== VERIFICANDO ESQUEMA DE SHOPIFY_STAFF ===");
    try {
      const [cols] = await bigquery.query({
        query: `SELECT column_name FROM \`${projectId}.raw_layer.INFORMATION_SCHEMA.COLUMNS\` WHERE table_name = 'shopify_staff'`
      });
      const colNames = cols.map(c => c.column_name);
      if (colNames.includes('team') || colNames.includes('role')) {
        console.log("Detectado esquema antiguo en raw_layer.shopify_staff.");
        const [rows] = await bigquery.query({
          query: `SELECT COUNT(*) as count FROM \`${projectId}.raw_layer.shopify_staff\``
        });
        if (rows[0].count > 0) {
          throw new Error("La tabla shopify_staff tiene el esquema antiguo pero NO ESTÁ VACÍA. Abortando para evitar pérdida de datos.");
        }
        console.log("La tabla está vacía. Recreando (DROP)...");
        await bigquery.dataset('raw_layer').table('shopify_staff').delete();
        console.log("✅ Tabla antigua eliminada.");
      }
    } catch (err) {
      if (!err.message.includes('Abortando') && !err.message.includes('Not found')) {
        console.log("Nota al verificar esquema (puede ser normal si no existe la tabla):", err.message);
      } else if (err.message.includes('Abortando')) {
        throw err;
      }
    }

    console.log("\n=== EJECUTANDO DDLs ===");
    for (const file of ddlFiles) {
      const filePath = path.join(__dirname, 'sql', file);
      const query = fs.readFileSync(filePath, 'utf8');
      console.log(`Ejecutando ${file}...`);
      
      const options = {
        query: query,
        location: location,
      };

      const [job] = await bigquery.createQueryJob(options);
      await job.promise();
      console.log(`✅ ${file} ejecutado exitosamente.`);
    }

    console.log("\n=== CREANDO VISTAS ===");
    const viewFiles = [
      'views/v_activity_with_team.sql',
      'views/v_audit_log_enriched.sql'
    ];
    for (const viewFile of viewFiles) {
      const viewFilePath = path.join(__dirname, 'sql', viewFile);
      if (fs.existsSync(viewFilePath)) {
        console.log(`Ejecutando ${viewFile}...`);
        let viewQuery = fs.readFileSync(viewFilePath, 'utf8');
        
        // Inject project id
        viewQuery = viewQuery.replace(/<proyecto>/g, projectId);

        const [viewJob] = await bigquery.createQueryJob({ query: viewQuery, location: location });
        await viewJob.promise();
        console.log(`✅ ${viewFile} ejecutado exitosamente.`);
      }
    }

    console.log("\n=== VERIFICANDO TABLAS (INFORMATION_SCHEMA) ===");
    for (const datasetId of datasets) {
      const query = `
        SELECT 
          table_name, 
          is_insertable_into
        FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.TABLES\`
      `;
      const [rows] = await bigquery.query({ query, location });
      
      console.log(`\nDataset: ${datasetId}`);
      if (rows.length === 0) {
        console.log("  No se encontraron tablas.");
      }
      for (const row of rows) {
        console.log(`  - Tabla: ${row.table_name}`);
        
        // Consultar particiones y clusters usando INFORMATION_SCHEMA.COLUMNS
        const partitionQuery = `
          SELECT column_name, is_partitioning_column, clustering_ordinal_position
          FROM \`${projectId}.${datasetId}.INFORMATION_SCHEMA.COLUMNS\`
          WHERE table_name = '${row.table_name}'
            AND (is_partitioning_column = 'YES' OR clustering_ordinal_position IS NOT NULL)
          ORDER BY clustering_ordinal_position ASC
        `;
        const [colRows] = await bigquery.query({ query: partitionQuery, location });
        
        const partitionCol = colRows.find(c => c.is_partitioning_column === 'YES');
        const clusterCols = colRows.filter(c => c.clustering_ordinal_position !== null).map(c => c.column_name);
        
        if (partitionCol) {
          console.log(`      Partición: ${partitionCol.column_name}`);
        } else {
          console.log(`      Partición: Ninguna`);
        }
        
        if (clusterCols.length > 0) {
          console.log(`      Cluster: ${clusterCols.join(', ')}`);
        } else {
          console.log(`      Cluster: Ninguno`);
        }
      }
    }

    console.log("\n✅ PROCESO COMPLETADO EXITOSAMENTE.");
  } catch (error) {
    console.error("\n❌ Error durante la aplicación de DDL:", error);
  }
}

applyDDL();
