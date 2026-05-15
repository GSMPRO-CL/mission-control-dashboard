import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({
  projectId: process.env.GCP_PROJECT_ID,
});

export async function GET() {
  try {
    const datasetId = 'ecommerce_data';
    const tableId = 'shopify_customers';

    // 1. KPIs Globales
    const kpiQuery = `
      SELECT
        COUNT(id) as total_customers,
        SUM(total_spent) as global_revenue,
        AVG(total_spent) as global_ltv,
        AVG(orders_count) as global_recurrence
      FROM \`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\`
      WHERE orders_count > 0
    `;

    // 2. Distribución Geográfica (Top Ciudades)
    const geoQuery = `
      SELECT
        city,
        province,
        COUNT(id) as total_customers,
        SUM(total_spent) as total_revenue,
        AVG(total_spent) as avg_ltv,
        AVG(orders_count) as avg_orders
      FROM \`${process.env.GCP_PROJECT_ID}.${datasetId}.${tableId}\`
      WHERE country = 'Chile' AND city IS NOT NULL AND city != '' AND orders_count > 0
      GROUP BY city, province
      ORDER BY total_customers DESC
      LIMIT 20
    `;

    const [kpiRows] = await bigquery.query(kpiQuery);
    const [geoRows] = await bigquery.query(geoQuery);

    const kpis = kpiRows[0] || {
      total_customers: 0,
      global_revenue: 0,
      global_ltv: 0,
      global_recurrence: 0
    };

    return NextResponse.json({
      success: true,
      data: {
        kpis,
        geographicDistribution: geoRows
      }
    });
  } catch (error: any) {
    console.error('Error fetching segmentacion data:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor al consultar datos de segmentación', details: error.message },
      { status: 500 }
    );
  }
}
