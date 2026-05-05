const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });

async function run() {
  try {
    const [rows] = await bq.query(`
      SELECT action, count(*) as count
      FROM \`atomic-box-494614-r5.raw_layer.shopify_audit_log\`
      GROUP BY action
      ORDER BY count DESC
    `);
    console.log("Acciones registradas:");
    console.log(rows);
  } catch (e) {
    console.error(e);
  }
}
run();
