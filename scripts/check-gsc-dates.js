require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function check() {
  const [rows] = await bigquery.query({
    query: `SELECT date, page, impressions, position
            FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\`
            WHERE page LIKE '%mac-mini-m4%'
            LIMIT 10`
  });
  console.log("GSC for Mac Mini:");
  console.table(rows);

  const [dateRows] = await bigquery.query({
    query: `SELECT MIN(date) as min_date, MAX(date) as max_date
            FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\``
  });
  console.log("GSC Date Range:");
  console.table(dateRows);
}
check();
