require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function testQuery() {
  const query = `
      WITH TopSelling AS (
        SELECT
          L.product_id,
          L.title as product_title,
          COALESCE(L.vendor, 'Desconocido') as brand,
          SUM(L.quantity) as quantity_sold,
          SUM(CAST(L.price AS FLOAT64) * L.quantity) as gross_revenue
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_order_lines\` L
        JOIN \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\` O 
          ON L.order_id = O.id
        WHERE O.created_at >= TIMESTAMP(@startDate) AND O.created_at <= TIMESTAMP(@endDate)
          AND O.financial_status IN ('paid', 'partially_refunded')
        GROUP BY L.product_id, L.title, L.vendor
        ORDER BY gross_revenue DESC
        LIMIT 100
      )
      SELECT 
        T.product_id,
        T.product_title,
        T.brand,
        T.quantity_sold,
        T.gross_revenue,
        P.handle,
        (
          SELECT SUM(G.position * G.impressions) / NULLIF(SUM(G.impressions), 0)
          FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` G
          WHERE REGEXP_CONTAINS(G.page, CONCAT('/products/', P.handle, '([/?]|$)'))
            AND G.date >= DATE(TIMESTAMP(@startDate)) AND G.date <= DATE(TIMESTAMP(@endDate))
        ) as seo_position
      FROM TopSelling T
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\` P
        ON T.product_id = P.id
      ORDER BY T.gross_revenue DESC
  `;

  try {
    const [rows] = await bigquery.query({
      query,
      params: {
        startDate: '2026-04-01T00:00:00.000Z',
        endDate: '2026-04-30T23:59:59.000Z'
      }
    });
    console.log(`Query returned ${rows.length} rows.`);
    console.log(rows.slice(0, 5));
  } catch (err) {
    console.error("Error executing query:", err);
  }
}

testQuery();
