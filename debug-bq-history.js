const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config({ path: __dirname + '/.env' });

async function test() {
  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const query = `
    WITH base_data AS (
      SELECT 
        keyword,
        product_id,
        organic_position,
        paid_position,
        top_competitor_name,
        top_competitor_price,
        scan_date,
        scraped_at,
        ROW_NUMBER() OVER (PARTITION BY keyword ORDER BY scan_date DESC, scraped_at DESC) as rn
      FROM \`raw_layer.shopping_position\`
    ),
    history_data AS (
      SELECT
        keyword,
        ARRAY_AGG(
          STRUCT(
            scan_date, 
            organic_position, 
            paid_position
          ) ORDER BY scan_date ASC
        ) as history
      FROM \`raw_layer.shopping_position\`
      GROUP BY keyword
    )
    SELECT 
      l.keyword,
      l.organic_position,
      h.history
    FROM base_data l
    LEFT JOIN history_data h ON l.keyword = h.keyword
    WHERE l.rn = 1
    LIMIT 2
  `;
  try {
    const [rows] = await bq.query({ query });
    console.dir(rows, { depth: null });
  } catch (e) {
    console.error(e);
  }
}

test();
