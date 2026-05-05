require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const readline = require('readline');
const os = require('os');
const path = require('path');

const DATASET_ID = 'raw_layer';
const DEFAULT_CSV_PATH = '/tmp/staff-seed.csv';
const TEMPLATE_CSV_PATH = '/tmp/staff-seed-template.csv';

function parseArgs() {
  const args = process.argv.slice(2);
  let csvPath = DEFAULT_CSV_PATH;
  
  for (let arg of args) {
    if (arg.startsWith('--csv=')) {
      csvPath = arg.substring(6);
    }
  }
  return { csvPath };
}

function parseCSVLine(line) {
  const parts = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function generateTemplate() {
  const templateContent = `# GSMPRO.CL - Plantilla de seed manual de staff
# Llenar una fila por cada colaborador. Guardar como /tmp/staff-seed.csv para importar.
# 
# CÓMO OBTENER staff_id:
# En Shopify admin → Settings → Users and permissions → click en cada usuario.
# La URL del navegador termina con el ID numérico:
# admin.shopify.com/store/gsmprocl/settings/account/users/123456789 → staff_id = 123456789
#
# CONVENCIÓN employee_code: nombre.apellido en minúsculas, sin tildes ni espacios.
# Ejemplo: María González → maria.gonzalez
#
staff_id,email,first_name,last_name,employee_code,active,joined_at
1234567890,juan.perez@gsmpro.cl,Juan,Perez,juan.perez,TRUE,2024-03-15`;

  fs.writeFileSync(TEMPLATE_CSV_PATH, templateContent);
  console.log(`Template generado en ${TEMPLATE_CSV_PATH}`);
  console.log(`Edítalo, guárdalo como ${DEFAULT_CSV_PATH} y reejecuta este script.`);
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
        joined_at = S.joined_at,
        updated_at = S.updated_at
    WHEN NOT MATCHED THEN
      INSERT (staff_id, email, first_name, last_name, employee_code, active, joined_at, left_at, updated_at)
      VALUES (S.staff_id, S.email, S.first_name, S.last_name, S.employee_code, S.active, S.joined_at, NULL, S.updated_at)
  `;

  console.log(`Ejecutando MERGE para ${targetTableName}...`);
  const [job] = await bq.createQueryJob({ query });
  await job.promise();
  console.log(`✅ MERGE completado para ${targetTableName}.`);
}

async function seedStaff() {
  const { csvPath } = parseArgs();

  if (!fs.existsSync(csvPath)) {
    generateTemplate();
    process.exit(1);
  }

  const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  let existingStaffIds = [];
  try {
    const [rows] = await bigquery.query(`SELECT staff_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\``);
    existingStaffIds = rows.map(r => r.staff_id);
  } catch (e) {
    console.error("❌ Error consultando BigQuery. ¿Ya ejecutaste el apply-attribution-ddl.js?");
    process.exit(1);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = false;
  let lines = [];
  
  for await (const line of rl) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (!isHeader) {
      isHeader = true; // Ignorar la fila de header
      continue;
    }
    lines.push(line);
  }

  const toProcess = [];
  const errors = [];
  const seenStaffIds = new Set();
  const seenEmployeeCodes = new Set();

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) {
      errors.push(`Fila ${i + 1}: Faltan columnas. Requeridas 7, recibidas ${cols.length}`);
      continue;
    }

    let [staffId, email, firstName, lastName, employeeCode, activeStr, joinedAtStr] = cols;
    
    // Validar staff_id
    if (!staffId || !/^\d+$/.test(staffId)) {
      errors.push(`Fila ${i + 1}: staff_id vacío o no numérico '${staffId}'.`);
    } else if (seenStaffIds.has(staffId)) {
      errors.push(`Fila ${i + 1}: staff_id duplicado dentro del CSV '${staffId}'.`);
    } else {
      seenStaffIds.add(staffId);
    }

    // Validar email
    if (!email || !email.includes('@')) {
      errors.push(`Fila ${i + 1}: email inválido '${email}'.`);
    }

    // Validar employee_code
    const empCodeRegex = /^[a-z0-9._-]+$/;
    if (!employeeCode || !empCodeRegex.test(employeeCode)) {
      errors.push(`Fila ${i + 1}: employee_code inválido '${employeeCode}'. Debe coincidir con ^[a-z0-9._-]+$`);
    } else if (seenEmployeeCodes.has(employeeCode)) {
      errors.push(`Fila ${i + 1}: employee_code duplicado dentro del CSV '${employeeCode}'.`);
    } else {
      seenEmployeeCodes.add(employeeCode);
    }

    // Validar active
    activeStr = activeStr ? activeStr.toUpperCase() : 'TRUE';
    if (activeStr !== 'TRUE' && activeStr !== 'FALSE') {
      errors.push(`Fila ${i + 1}: active inválido '${activeStr}'. Debe ser TRUE o FALSE.`);
    }
    const isActive = activeStr === 'TRUE';

    // Validar joined_at
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    let joinedAt = null;
    if (joinedAtStr) {
      if (!dateRegex.test(joinedAtStr) || isNaN(Date.parse(joinedAtStr))) {
        errors.push(`Fila ${i + 1}: joined_at inválido '${joinedAtStr}'. Formato esperado: YYYY-MM-DD.`);
      } else {
        joinedAt = joinedAtStr;
      }
    }

    if (errors.length === 0) {
      toProcess.push({
        staff_id: staffId,
        email: email,
        first_name: firstName || null,
        last_name: lastName || null,
        employee_code: employeeCode,
        active: isActive,
        joined_at: joinedAt,
        updated_at: new Date().toISOString()
      });
    }
  }

  if (errors.length > 0) {
    console.error("=== ERRORES DE VALIDACIÓN (DRY RUN) ===");
    errors.forEach(e => console.error(`  - ${e}`));
    console.error("\n❌ Corrige el CSV y vuelve a intentarlo. No se ha modificado BigQuery.");
    process.exit(1);
  }

  const toInsert = toProcess.filter(p => !existingStaffIds.includes(p.staff_id)).length;
  const toUpdate = toProcess.length - toInsert;

  console.log(`=== DRY-RUN ===`);
  console.log(`Filas válidas:     ${toProcess.length}`);
  console.log(`Nuevos a insertar: ${toInsert}`);
  console.log(`A actualizar:      ${toUpdate}`);

  const confirmUI = readline.createInterface({ input: process.stdin, output: process.stdout });

  confirmUI.question('\n¿Aplicar cambios? (yes/no): ', async (answer) => {
    confirmUI.close();
    if (answer.toLowerCase() !== 'yes') {
      console.log("Operación cancelada.");
      return;
    }

    console.log("\n=== APLICANDO CAMBIOS ===");
    try {
      const dataset = bigquery.dataset(DATASET_ID);
      const timestamp = Date.now();
      const stagingTable = `shopify_staff_staging_${timestamp}`;

      await writeNdjsonAndLoad(bigquery, dataset, 'shopify_staff', stagingTable, toProcess);
      await runMerge(bigquery, stagingTable, 'shopify_staff');

      console.log("Limpiando tabla staging...");
      await dataset.table(stagingTable).delete();

      console.log("\n=== SEED STAFF COMPLETADO ===");
      console.log(`Filas procesadas:  ${toProcess.length}`);
      console.log(`Insertados:        ${toInsert}`);
      console.log(`Actualizados:      ${toUpdate}`);
      console.log("\nPróximo paso:");
      console.log("  node scripts/export-staff-csv.js");

    } catch (err) {
      console.error("\n❌ Error procesando inserción:", err.message);
    }
  });
}

seedStaff();
