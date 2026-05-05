import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Default to MTD
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam))) ? new Date(startDateParam) : firstDayOfMonth;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam))) ? new Date(endDateParam) : now;

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

    const options = {
      query: query,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const brandQuery = `
      SELECT
        COALESCE(L.vendor, 'Desconocido') as brand,
        SUM(L.quantity) as quantity_sold,
        SUM(CAST(L.price AS FLOAT64) * L.quantity) as gross_revenue
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_order_lines\` L
      JOIN \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\` O 
        ON L.order_id = O.id
      WHERE O.created_at >= TIMESTAMP(@startDate) AND O.created_at <= TIMESTAMP(@endDate)
        AND O.financial_status IN ('paid', 'partially_refunded')
      GROUP BY L.vendor
      ORDER BY gross_revenue DESC
      LIMIT 20
    `;

    const brandOptions = {
      query: brandQuery,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const [[productRows], [brandRows]] = await Promise.all([
      bigquery.query(options),
      bigquery.query(brandOptions)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        topProducts: productRows.map(row => ({
          productId: row.product_id,
          title: row.product_title,
          brand: row.brand,
          quantity: parseInt(row.quantity_sold, 10) || 0,
          revenue: parseFloat(row.gross_revenue) || 0,
          seoPosition: row.seo_position ? parseFloat(row.seo_position) : null
        })),
        topBrands: brandRows.map(row => ({
          brand: row.brand,
          quantity: parseInt(row.quantity_sold, 10) || 0,
          revenue: parseFloat(row.gross_revenue) || 0
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching Product Sales:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product data' }, { status: 500 });
  }
}
