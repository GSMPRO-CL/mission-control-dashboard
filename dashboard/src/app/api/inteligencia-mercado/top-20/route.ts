import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bq = new BigQuery();

export async function GET() {
  try {
    const query = `
      WITH top_products AS (
        SELECT
          l.product_id,
          l.title,
          SUM(l.quantity) as total_sold
        FROM \`atomic-box-494614-r5.ecommerce_data.shopify_order_lines\` l
        JOIN \`atomic-box-494614-r5.ecommerce_data.shopify_orders\` o
          ON l.order_id = o.id
        WHERE o.created_at >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
          AND o.financial_status = 'paid'
        GROUP BY l.product_id, l.title
        ORDER BY total_sold DESC
        LIMIT 20
      ),
      latest_prices AS (
        SELECT
          product_id,
          our_price,
          AVG(competitor_price) as avg_competitor_price,
          MIN(competitor_price) as min_competitor_price
        FROM \`atomic-box-494614-r5.ecommerce_data.competitor_prices\`
        GROUP BY product_id, our_price
      )
      SELECT
        t.product_id as id,
        t.title,
        t.total_sold,
        p.our_price,
        p.avg_competitor_price,
        p.min_competitor_price
      FROM top_products t
      LEFT JOIN latest_prices p ON t.product_id = p.product_id
      ORDER BY t.total_sold DESC
    `;

    const [rows] = await bq.query({ query });

    return NextResponse.json({ success: true, data: rows });
  } catch (err: any) {
    console.error('Error fetching Top 20:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
