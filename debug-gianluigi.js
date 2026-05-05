const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });

async function run() {
  try {
    const [rows] = await bq.query(`
      SELECT audit_id, occurred_at, staff_id, action, TO_JSON_STRING(raw_payload) as payload
      FROM \`atomic-box-494614-r5.raw_layer.shopify_audit_log\`
      WHERE LOWER(TO_JSON_STRING(raw_payload)) LIKE '%gianl%'
      ORDER BY occurred_at DESC
      LIMIT 10
    `);
    console.log("Eventos encontrados:", rows.length);
    rows.forEach(r => {
      const payload = JSON.parse(r.payload);
      console.log(`- ${r.occurred_at.value} | StaffID: ${r.staff_id} | Action: ${r.action} | Message: ${payload.message}`);
    });
  } catch (e) {
    console.error(e);
  }
}
run();
