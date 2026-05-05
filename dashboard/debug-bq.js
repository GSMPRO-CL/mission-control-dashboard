const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID || 'atomic-box-494614-r5' });

async function run() {
  try {
    const query = `
      SELECT
        SUM(total_price) as gross_sales,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) as net_sales,
        COUNT(id) as gross_order_count,
        COUNT(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN id END) as net_order_count,
        SUM(total_discounts) as total_discounts,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_discounts ELSE 0 END) as net_discounts
      FROM \`atomic-box-494614-r5.ecommerce_data.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
    `;

    const options = {
      query: query,
      params: {
        startDate: '2026-02-01T00:00:00Z',
        endDate: '2026-02-28T23:59:59Z'
      }
    };
    console.log("Running query...");
    const [rows] = await bigquery.query(options);
    console.log("Success!", rows);
  } catch (error) {
    console.error("Error Details:", {
      message: error.message,
      errors: error.errors,
      code: error.code
    });
  }
}

run();
