require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const readline = require('readline');

const DATASET_ID = 'raw_layer';
const VALID_TEAMS = ['management', 'support_ecommerce', 'operations', 'customer_service', 'executive'];

function generateUUID() {
  return require('crypto').randomUUID();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const params = {};
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      params[key] = value !== undefined ? value : true;
    }
  }
  return { command, params };
}

async function validateStaffExists(bq, employeeCode) {
  const [rows] = await bq.query(`SELECT employee_code FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\` WHERE employee_code = '${employeeCode}'`);
  if (rows.length === 0) {
    throw new Error(`employee_code '${employeeCode}' no existe en shopify_staff.`);
  }
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function handleAdd(bq, params) {
  const { 'employee-code': empCode, team, role, from, to, allocation, 'not-primary': notPrimary, notes } = params;

  if (!empCode || !team || !role || !from) {
    console.error("Faltan argumentos obligatorios: --employee-code, --team, --role, --from");
    process.exit(1);
  }

  if (!VALID_TEAMS.includes(team)) {
    console.error(`Equipo inválido '${team}'. Permitidos: ${VALID_TEAMS.join(', ')}`);
    process.exit(1);
  }

  await validateStaffExists(bq, empCode);

  const isPrimary = !notPrimary;
  const allocPct = allocation ? parseInt(allocation, 10) : 100;
  const validTo = to ? `DATE('${to}')` : 'NULL';

  if (isPrimary) {
    const checkQuery = `
      SELECT assignment_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
      WHERE employee_code = '${empCode}' AND is_primary = TRUE AND valid_to IS NULL
    `;
    const [existingRows] = await bq.query({ query: checkQuery });
    if (existingRows.length > 0) {
      console.log(`⚠️ Advertencia: Ya existe una asignación principal (primary) vigente para ${empCode}.`);
      const ans = await prompt('¿Deseas cerrarla automáticamente para establecer esta nueva? (yes/no): ');
      if (ans.toLowerCase() !== 'yes') {
        console.log("Operación cancelada. Usa --not-primary si quieres agregar un apoyo temporal.");
        return;
      }
      
      const closeQuery = `
        UPDATE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
        SET valid_to = DATE_SUB(DATE('${from}'), INTERVAL 1 DAY)
        WHERE employee_code = '${empCode}' AND is_primary = TRUE AND valid_to IS NULL
      `;
      await bq.createQueryJob({ query: closeQuery }).then(j => j[0].promise());
      console.log("✅ Asignación anterior cerrada.");
    }
  }

  const insertQuery = `
    INSERT INTO \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
    (assignment_id, employee_code, team, role, allocation_pct, valid_from, valid_to, is_primary, notes, created_at, created_by)
    VALUES (
      '${generateUUID()}',
      '${empCode}',
      '${team}',
      '${role}',
      ${allocPct},
      DATE('${from}'),
      ${validTo},
      ${isPrimary},
      '${notes || ''}',
      CURRENT_TIMESTAMP(),
      'cli-add'
    )
  `;
  await bq.createQueryJob({ query: insertQuery }).then(j => j[0].promise());
  console.log("✅ Asignación agregada exitosamente.");
}

async function handleChange(bq, params) {
  const { 'employee-code': empCode, 'new-team': newTeam, 'new-role': newRole, effective } = params;

  if (!empCode || !newTeam || !newRole || !effective) {
    console.error("Faltan argumentos obligatorios: --employee-code, --new-team, --new-role, --effective");
    process.exit(1);
  }

  if (!VALID_TEAMS.includes(newTeam)) {
    console.error(`Equipo inválido '${newTeam}'. Permitidos: ${VALID_TEAMS.join(', ')}`);
    process.exit(1);
  }

  await validateStaffExists(bq, empCode);

  const checkQuery = `
    SELECT assignment_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
    WHERE employee_code = '${empCode}' AND is_primary = TRUE AND valid_to IS NULL
  `;
  const [existingRows] = await bq.query({ query: checkQuery });
  
  if (existingRows.length === 0) {
    console.error(`No existe una asignación principal vigente para ${empCode}. Usa 'add' en su lugar.`);
    process.exit(1);
  }

  // Operación: UPDATE y luego INSERT. Para hacerlo atómico en BQ, usamos multi-statement transaction
  const txQuery = `
    BEGIN TRANSACTION;
      UPDATE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
      SET valid_to = DATE_SUB(DATE('${effective}'), INTERVAL 1 DAY)
      WHERE employee_code = '${empCode}' AND is_primary = TRUE AND valid_to IS NULL;

      INSERT INTO \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
      (assignment_id, employee_code, team, role, allocation_pct, valid_from, valid_to, is_primary, created_at, created_by)
      VALUES (
        '${generateUUID()}',
        '${empCode}',
        '${newTeam}',
        '${newRole}',
        100,
        DATE('${effective}'),
        NULL,
        TRUE,
        CURRENT_TIMESTAMP(),
        'cli-change'
      );
    COMMIT TRANSACTION;
  `;

  try {
    const [job] = await bq.createQueryJob({ query: txQuery });
    await job.promise();
    console.log("✅ Asignación principal cambiada exitosamente.");
  } catch (err) {
    console.error("❌ Error durante el cambio (Rollback automático en caso de falla DML):", err.message);
  }
}

async function handleList(bq, params) {
  const { 'employee-code': empCode, 'include-expired': includeExpired } = params;

  let whereClause = includeExpired ? "1=1" : "valid_to IS NULL";
  if (empCode && empCode !== true) {
    whereClause += ` AND employee_code = '${empCode}'`;
  }

  const query = `
    SELECT employee_code, team, role, valid_from, valid_to, is_primary, allocation_pct
    FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\`
    WHERE ${whereClause}
    ORDER BY employee_code, valid_from DESC
  `;

  try {
    const [rows] = await bq.query({ query });
    if (rows.length === 0) {
      console.log("No se encontraron asignaciones.");
      return;
    }

    console.table(rows.map(r => ({
      ...r,
      valid_from: r.valid_from ? r.valid_from.value : null,
      valid_to: r.valid_to ? r.valid_to.value : null
    })));
  } catch(e) {
    console.error("Error al listar:", e.message);
  }
}

async function main() {
  const { command, params } = parseArgs();
  const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

  try {
    if (command === 'add') {
      await handleAdd(bigquery, params);
    } else if (command === 'change') {
      await handleChange(bigquery, params);
    } else if (command === 'list') {
      await handleList(bigquery, params);
    } else {
      console.log("Comandos válidos: add, change, list");
      console.log("Ejemplo: node scripts/manage-assignment.js list");
    }
  } catch (error) {
    console.error("❌ Error de ejecución:", error.message);
  }
}

main();
