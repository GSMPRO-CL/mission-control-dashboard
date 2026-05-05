require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const fs = require('fs');
const path = require('path');

const DATASET_ID = 'raw_layer';
const FILE_PATH = '/tmp/staff-assignments-template.csv';

async function exportCSV() {
  console.log("=== EXPORTANDO STAFF A CSV ===");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

    const query = `
      SELECT 
        s.employee_code,
        s.first_name,
        s.last_name,
        s.email,
        a.team AS current_team,
        a.role AS current_role
      FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.shopify_staff\` s
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.staff_assignments\` a
        ON s.employee_code = a.employee_code AND a.valid_to IS NULL AND a.is_primary = TRUE
      ORDER BY s.employee_code
    `;

    let rows = [];
    try {
      [rows] = await bigquery.query({ query });
    } catch (e) {
      console.error("❌ Error consultando BigQuery. ¿Ya ejecutaste el apply-attribution-ddl.js?");
      process.exit(1);
    }

    if (rows.length === 0) {
      console.log("⚠️ No hay staff en la base de datos. Ejecuta sync-shopify-staff.js primero.");
      return;
    }

    const header = [
      "# GSMPRO.CL - Plantilla de asignación de staff",
      "# Editar columnas new_team, new_role, valid_from, allocation_pct, is_primary, notes",
      "# Valores válidos para new_team: management, support_ecommerce, operations, customer_service, executive",
      "# allocation_pct: 1-100 (default 100)",
      "# is_primary: TRUE/FALSE (default TRUE)",
      "# valid_from formato: YYYY-MM-DD",
      "# Dejar new_team vacío para no modificar",
      "employee_code,first_name,last_name,email,current_team,current_role,new_team,new_role,valid_from,allocation_pct,is_primary,notes"
    ];

    const lines = rows.map(r => {
      const fn = r.first_name || '';
      const ln = r.last_name || '';
      const ct = r.current_team || '';
      const cr = r.current_role || '';
      return `${r.employee_code},${fn},${ln},${r.email},${ct},${cr},,,,,,`;
    });

    const csvContent = header.concat(lines).join('\n');
    fs.writeFileSync(FILE_PATH, csvContent);

    console.log(`✅ Archivo exportado exitosamente: ${FILE_PATH}`);
    console.log(`✅ Filas exportadas: ${lines.length}`);
    console.log("\nEdita el archivo, guarda los cambios y luego ejecuta import-staff-csv.js");
  } catch (error) {
    console.error("❌ Error exportando CSV:", error);
  }
}

exportCSV();
