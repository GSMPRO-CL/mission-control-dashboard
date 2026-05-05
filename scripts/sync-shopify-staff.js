require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { shopifyGraphQL } = require('./lib/shopify-graphql');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATASET_ID = 'raw_layer';

function normalizeStaffId(gid) {
  if (!gid) return null;
  const match = gid.match(/\/StaffMember\/(\d+)$/);
  return match ? match[1] : gid;
}

function deriveEmployeeCode(email, firstName, lastName) {
  if (firstName && lastName) {
    const fn = firstName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    const ln = lastName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
    return `${fn}.${ln}`;
  }
  if (email) {
    return email.split('@')[0].toLowerCase();
  }
  return `unknown.${Date.now()}`;
}

async function writeNdjsonAndLoad(bq, dataset, tableName, stagingTableName, dataArray) {
  if (dataArray.length === 0) return;
  const tempFilePath = path.join(os.tmpdir(), `${stagingTableName}.ndjson`);
  const ndjsonContent = dataArray.map(obj => JSON.stringify(obj)).join('\n');
  fs.writeFileSync(tempFilePath, ndjsonContent);

  const stagingTable = dataset.table(stagingTableName);
  const targetTable = dataset.table(tableName);
  const [metadata] = await targetTable.getMetadata();
  const schema = metadata.schema;

  console.log(`Creando tabla staging ${stagingTableName}...`);
  await stagingTable.create({ schema });

  console.log(`Cargando datos en ${stagingTableName} (Load Job)...`);
  await stagingTable.load(tempFilePath, {
    sourceFormat: 'NEWLINE_DELIMITED_JSON'
  });

  fs.unlinkSync(tempFilePath);
}

async function runMerge(bq, stagingTableName, targetTableName) {
  const projectId = process.env.GCP_PROJECT_ID;
  const targetPath = `\`${projectId}.${DATASET_ID}.${targetTableName}\``;
  const stagingPath = `\`${projectId}.${DATASET_ID}.${stagingTableName}\``;

  const query = `
    MERGE ${targetPath} T
    USING ${stagingPath} S
    ON T.staff_id = S.staff_id
    WHEN MATCHED THEN
      UPDATE SET 
        email = S.email,
        first_name = S.first_name,
        last_name = S.last_name,
        active = S.active,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (staff_id, email, first_name, last_name, employee_code, active, joined_at, left_at, updated_at)
      VALUES (S.staff_id, S.email, S.first_name, S.last_name, S.employee_code, S.active, S.joined_at, S.left_at, S.updated_at)
  `;

  console.log(`Ejecutando MERGE para ${targetTableName}...`);
  const [job] = await bq.createQueryJob({ query });
  await job.promise();
  console.log(`✅ MERGE completado para ${targetTableName}.`);
}

async function runSync() {
  console.log("=== INICIANDO SYNC DE STAFF SHOPIFY -> BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const dataset = bigquery.dataset(DATASET_ID);
    
    let staffData = [];
    let dataSource = 'Ninguna';

    // Intento 1: GraphQL staffMembers
    try {
      console.log("Intentando Camino 2 (GraphQL staffMembers)...");
      const queryStaff = `
        query getStaff($cursor: String) {
          staffMembers(first: 50, after: $cursor) {
            edges {
              node {
                id
                email
                firstName
                lastName
                active
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;
      const result = await shopifyGraphQL(queryStaff, {}, { paginate: true, connectionPath: 'staffMembers' });
      staffData = result.map(edge => ({
        staff_id: normalizeStaffId(edge.node.id),
        email: edge.node.email,
        first_name: edge.node.firstName,
        last_name: edge.node.lastName,
        employee_code: deriveEmployeeCode(edge.node.email, edge.node.firstName, edge.node.lastName),
        active: edge.node.active,
        joined_at: null,
        left_at: null,
        updated_at: new Date().toISOString()
      }));
      dataSource = 'GraphQL staffMembers';
      console.log(`✅ Éxito con GraphQL. ${staffData.length} staff obtenidos.`);
    } catch (gqlError) {
      console.log(`⚠️ Falló Camino 2 (${gqlError.message}). Ejecutando Fallback a Camino 1 (Audit Log)...`);
      
      const queryFallback = `
        SELECT DISTINCT staff_id, staff_email
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_audit_log\`
        WHERE staff_id IS NOT NULL
          AND occurred_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
      `;
      try {
        const [rows] = await bigquery.query({ query: queryFallback });
        staffData = rows.map(r => ({
          staff_id: r.staff_id,
          email: r.staff_email,
          first_name: null,
          last_name: null,
          employee_code: deriveEmployeeCode(r.staff_email, null, null),
          active: true,
          joined_at: null,
          left_at: null,
          updated_at: new Date().toISOString()
        }));
        dataSource = 'Audit Log fallback';
        console.log(`✅ Éxito con Fallback. ${staffData.length} staff detectados en Audit Log.`);
      } catch (bqError) {
        if (bqError.message.includes('Not found')) {
          console.log("⚠️ La tabla shopify_audit_log no existe o está vacía.");
        } else {
          throw bqError;
        }
      }
    }

    if (staffData.length === 0) {
      console.log("No se detectó ningún staff para procesar.");
      return;
    }

    // Identificar nuevos staff vs base de datos actual
    let currentStaffIds = [];
    try {
      const [currentRows] = await bigquery.query({
        query: `SELECT staff_id, employee_code FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\``
      });
      currentStaffIds = currentRows.map(r => r.staff_id);
    } catch (e) {
      // Ignorar si la tabla no existe o está vacía
    }

    const newStaff = staffData.filter(s => !currentStaffIds.includes(s.staff_id));
    if (newStaff.length > 0) {
      console.log(`\n=== DETECCIÓN DE STAFF NUEVO (${newStaff.length}) ===`);
      newStaff.forEach(s => {
        console.log(`[staff-sync] STAFF NUEVO DETECTADO: ${s.staff_id} (${s.email}) → requiere asignación de team/role`);
      });
      console.log("======================================\n");
    }

    const timestamp = Date.now();
    const stagingTable = `shopify_staff_staging_${timestamp}`;

    await writeNdjsonAndLoad(bigquery, dataset, 'shopify_staff', stagingTable, staffData);
    await runMerge(bigquery, stagingTable, 'shopify_staff');

    console.log("Limpiando tabla staging...");
    await dataset.table(stagingTable).delete();

    // Verificación final para staff sin asignación en staff_assignments
    let staffSinAsignacion = [];
    try {
      const queryCheck = `
        SELECT s.employee_code 
        FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\` s
        LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\` a
          ON s.employee_code = a.employee_code AND a.valid_to IS NULL
        WHERE a.employee_code IS NULL
      `;
      const [unassignedRows] = await bigquery.query({ query: queryCheck });
      staffSinAsignacion = unassignedRows.map(r => r.employee_code);
    } catch(e) {
      // Ignorar si staff_assignments no existe
    }

    console.log("\n=== SYNC STAFF COMPLETADO ===");
    console.log(`Fuente usada:           ${dataSource}`);
    console.log(`Staff detectados:       ${staffData.length}`);
    console.log(`Staff nuevos:           ${newStaff.length}`);
    console.log(`Staff actualizados:     ${staffData.length - newStaff.length}`);
    
    if (staffSinAsignacion.length > 0) {
      console.log(`Staff sin asignación:   ${staffSinAsignacion.length}`);
      staffSinAsignacion.forEach(code => console.log(`  - ${code}`));
      console.log("\nPróximo paso si hay staff sin asignación:");
      console.log("  node scripts/export-staff-csv.js");
    } else {
      console.log(`Staff sin asignación:   0`);
    }

  } catch (err) {
    console.error("❌ Error durante la sincronización:", err);
  }
}

runSync();
