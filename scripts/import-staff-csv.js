require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const readline = require('readline');

const DATASET_ID = 'raw_layer';
const VALID_TEAMS = ['management', 'support_ecommerce', 'operations', 'customer_service', 'executive'];

function generateUUID() {
  return require('crypto').randomUUID();
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

async function importCSV() {
  const args = process.argv.slice(2);
  const filePath = args[0] || '/tmp/staff-assignments-template.csv';

  console.log(`=== IMPORTANDO STAFF DESDE CSV ===`);
  console.log(`Archivo: ${filePath}\n`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ El archivo no existe: ${filePath}`);
    process.exit(1);
  }

  const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  
  // Validar si existen los employee_codes
  let validStaff = [];
  try {
    const [rows] = await bigquery.query(`SELECT employee_code FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\``);
    validStaff = rows.map(r => r.employee_code);
  } catch (e) {
    console.error("❌ Error consultando BigQuery. ¿Ya ejecutaste el apply-attribution-ddl.js?");
    process.exit(1);
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = false;
  let lines = [];
  
  for await (const line of rl) {
    if (line.trim() === '' || line.startsWith('#')) continue;
    if (!isHeader) {
      isHeader = true; // Ignorar el header que no tiene '#' (la de los nombres de columnas)
      continue;
    }
    lines.push(line);
  }

  const toProcess = [];
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 12) continue;

    const [empCode, fn, ln, email, ct, cr, newTeam, newRole, validFrom, allocPct, isPrimaryStr, notes] = cols;

    if (!newTeam) continue; // Salta si no hay cambios

    if (!VALID_TEAMS.includes(newTeam)) {
      errors.push(`Fila ${i + 1}: Equipo inválido '${newTeam}'. Valores permitidos: ${VALID_TEAMS.join(', ')}`);
    }

    if (!validStaff.includes(empCode)) {
      errors.push(`Fila ${i + 1}: employee_code '${empCode}' no existe en shopify_staff.`);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!validFrom || !dateRegex.test(validFrom) || isNaN(Date.parse(validFrom))) {
      errors.push(`Fila ${i + 1}: valid_from inválido '${validFrom}'. Formato esperado: YYYY-MM-DD.`);
    }

    const allocation = parseInt(allocPct || '100', 10);
    if (isNaN(allocation) || allocation < 1 || allocation > 100) {
      errors.push(`Fila ${i + 1}: allocation_pct inválido '${allocPct}'. Debe ser 1-100.`);
    }

    const isPrimary = isPrimaryStr ? isPrimaryStr.toUpperCase() === 'TRUE' : true;

    if (errors.length === 0) {
      toProcess.push({
        employee_code: empCode,
        team: newTeam,
        role: newRole || '',
        valid_from: validFrom,
        allocation_pct: allocation,
        is_primary: isPrimary,
        notes: notes || ''
      });
    }
  }

  if (errors.length > 0) {
    console.error("=== ERRORES DE VALIDACIÓN (DRY RUN) ===");
    errors.forEach(e => console.error(`  - ${e}`));
    console.error("\n❌ Corrige el CSV y vuelve a intentarlo.");
    process.exit(1);
  }

  if (toProcess.length === 0) {
    console.log("No hay asignaciones nuevas que procesar en el CSV (columna new_team vacía).");
    return;
  }

  console.log(`=== RESUMEN DE CAMBIOS (DRY RUN) ===`);
  console.log(`Se procesarán ${toProcess.length} nuevas asignaciones:`);
  toProcess.forEach(p => console.log(`  - ${p.employee_code} -> ${p.team} (${p.role}), desde: ${p.valid_from}, primary: ${p.is_primary}`));

  const readlineSync = require('readline');
  const confirmUI = readlineSync.createInterface({ input: process.stdin, output: process.stdout });

  confirmUI.question('\n¿Aplicar cambios? (yes/no): ', async (answer) => {
    confirmUI.close();
    if (answer.toLowerCase() !== 'yes') {
      console.log("Operación cancelada.");
      return;
    }

    console.log("\n=== APLICANDO CAMBIOS ===");
    let cerradas = 0;
    let insertadas = 0;

    for (const record of toProcess) {
      try {
        if (record.is_primary) {
          // Cerrar anterior primary vigente
          const closeQuery = `
            UPDATE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
            SET valid_to = DATE_SUB(DATE('${record.valid_from}'), INTERVAL 1 DAY)
            WHERE employee_code = '${record.employee_code}' 
              AND is_primary = TRUE 
              AND valid_to IS NULL
          `;
          const [job] = await bigquery.createQueryJob({ query: closeQuery });
          const [result] = await job.promise();
          // El DML devuelve el numero de filas afectadas en la info del job
          const numRows = job.metadata.statistics.query.numDmlAffectedRows;
          if (numRows && parseInt(numRows) > 0) {
            cerradas += parseInt(numRows);
          }
        }

        // Insertar la nueva
        const insertQuery = `
          INSERT INTO \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
          (assignment_id, employee_code, team, role, allocation_pct, valid_from, valid_to, is_primary, notes, created_at, created_by)
          VALUES (
            '${generateUUID()}',
            '${record.employee_code}',
            '${record.team}',
            '${record.role}',
            ${record.allocation_pct},
            DATE('${record.valid_from}'),
            NULL,
            ${record.is_primary},
            '${record.notes}',
            CURRENT_TIMESTAMP(),
            'csv-import'
          )
        `;
        const [insertJob] = await bigquery.createQueryJob({ query: insertQuery });
        await insertJob.promise();
        insertadas++;
      } catch (err) {
        console.error(`❌ Error procesando ${record.employee_code}:`, err.message);
      }
    }

    console.log("\n=== IMPORT COMPLETADO ===");
    console.log(`Filas procesadas:       ${toProcess.length}`);
    console.log(`Asignaciones cerradas:  ${cerradas} (vigencias anteriores)`);
    console.log(`Asignaciones nuevas:    ${insertadas}`);
    console.log(`Errores:                ${toProcess.length - insertadas}`);
  });
}

importCSV();
