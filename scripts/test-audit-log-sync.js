require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { spawnSync, spawn } = require('child_process');
const readline = require('readline');

const DATASET_ID = 'raw_layer';

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function runTest() {
  console.log("=== TEST E2E: AUDIT LOG PULLER ===\n");
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

  // 1. Validar que shopify_staff tenga datos
  try {
    const [rows] = await bq.query(`SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\``);
    if (rows[0].count === 0) {
      console.error("❌ Precondición fallida: raw_layer.shopify_staff está vacía.");
      process.exit(1);
    }
    console.log(`✅ Precondición: shopify_staff tiene ${rows[0].count} colaboradores registrados.`);
  } catch (err) {
    console.error("❌ Error verificando shopify_staff:", err.message);
    process.exit(1);
  }

  // 2. Ejecutar dry-run para las últimas 24 horas
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log(`\nEjecutando Dry-Run desde: ${yesterday}...`);
  
  const dryRun = spawnSync('node', ['scripts/sync-audit-log.js', '--dry-run', `--since=${yesterday}`], { encoding: 'utf8' });
  console.log(dryRun.stdout);
  
  if (dryRun.status !== 0) {
    console.error("❌ El dry-run falló.");
    console.error(dryRun.stderr);
    process.exit(1);
  }

  // 3. Confirmación para ejecución real
  const answer = await prompt("\n¿El dry-run se ve bien? ¿Deseas ejecutar la sync real ahora? (yes/no): ");
  if (answer.toLowerCase() !== 'yes') {
    console.log("Test abortado por el usuario.");
    return;
  }

  console.log("\nEjecutando Sync Real...");
  const realSync = spawnSync('node', ['scripts/sync-audit-log.js', `--since=${yesterday}`], { encoding: 'utf8', stdio: 'inherit' });
  
  if (realSync.status !== 0) {
    console.error("❌ La sync real falló.");
    process.exit(1);
  }

  // 4. Verificaciones Post-Sync
  console.log("\n=== VERIFICACIONES POST-SYNC ===");
  
  // Contar filas
  try {
    const [rows] = await bq.query(`SELECT COUNT(*) as count FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_audit_log\``);
    console.log(`Filas totales en shopify_audit_log: ${rows[0].count}`);
  } catch (err) {
    console.log("No se pudo contar audit_log (quizás la tabla está vacía).");
  }

  // Verificar checkpoint
  try {
    const [stateRows] = await bq.query(`SELECT last_processed_at, events_processed, last_run_status FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.audit_log_sync_state\``);
    if (stateRows.length > 0) {
      console.log(`Checkpoint estado: ${stateRows[0].last_run_status}, Eventos totales procesados: ${stateRows[0].events_processed}`);
      console.log(`Último evento procesado en fecha: ${stateRows[0].last_processed_at.value}`);
    } else {
      console.log("⚠️ Checkpoint vacío.");
    }
  } catch (err) {
    console.log("Error consultando checkpoint.");
  }

  // Listar staff_ids y matches
  try {
    const query = `
      SELECT 
        a.staff_id, 
        COUNT(a.audit_id) as event_count,
        MAX(s.first_name) as first_name,
        MAX(s.last_name) as last_name
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_audit_log\` a
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\` s
        ON a.staff_id = s.staff_id
      WHERE a.staff_id IS NOT NULL
      GROUP BY a.staff_id
      ORDER BY event_count DESC
    `;
    const [matchRows] = await bq.query({ query });
    console.log("\nResumen de atribución por staff_id:");
    console.table(matchRows.map(r => ({
      staff_id: r.staff_id,
      eventos: r.event_count,
      match: r.first_name ? '✅ SI' : '❌ NO (unknown)',
      nombre: r.first_name ? `${r.first_name} ${r.last_name}` : 'N/A'
    })));

    const unmatches = matchRows.filter(r => !r.first_name);
    if (unmatches.length > 0) {
      console.log("\n⚠️ ATENCIÓN: Se detectaron staff_ids con actividad que no están en shopify_staff.");
      console.log("Deberás añadir estos IDs manualmente usando el script de seed CSV si corresponden a empleados válidos.");
    } else {
      console.log("\n✅ Todos los staff_ids detectados matchearon exitosamente con la tabla de colaboradores.");
    }

  } catch (err) {
    console.log("Error calculando matches:", err.message);
  }

  console.log("\nTest end-to-end completado.");
}

runTest();
