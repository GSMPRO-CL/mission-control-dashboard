const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });

async function run() {
  try {
    const [auditRows] = await bq.query('SELECT staff_id, count(*) as c FROM `atomic-box-494614-r5.raw_layer.shopify_audit_log` WHERE staff_id IS NOT NULL GROUP BY staff_id LIMIT 5');
    console.log("Audit log samples:", auditRows);
    
    const [staffRows] = await bq.query('SELECT staff_id, first_name FROM `atomic-box-494614-r5.raw_layer.shopify_staff` LIMIT 5');
    console.log("Staff log samples:", staffRows);
    
    const [joinRows] = await bq.query(`
      SELECT a.staff_id, s.first_name 
      FROM \`atomic-box-494614-r5.raw_layer.shopify_audit_log\` a
      JOIN \`atomic-box-494614-r5.raw_layer.shopify_staff\` s 
        ON CAST(a.staff_id AS STRING) = CAST(s.staff_id AS STRING)
      LIMIT 5
    `);
    console.log("Join test:", joinRows);
  } catch (e) {
    console.error(e);
  }
}
run();
