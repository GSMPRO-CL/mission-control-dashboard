const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });

async function run() {
  try {
    const [rows] = await bq.query(`
      SELECT 
        IFNULL(s.first_name, a.staff_id) as empleado,
        COUNT(*) as cantidad_comentarios
      FROM \`atomic-box-494614-r5.raw_layer.shopify_audit_log\` a
      LEFT JOIN \`atomic-box-494614-r5.raw_layer.shopify_staff\` s 
        ON CAST(a.staff_id AS STRING) = CAST(s.staff_id AS STRING)
      WHERE a.action = 'comment'
      GROUP BY empleado
      ORDER BY cantidad_comentarios DESC
    `);
    console.log("=== COMENTARIOS POR EMPLEADO ===");
    console.table(rows);
  } catch (e) {
    console.error(e);
  }
}
run();
