import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let dateFilter = '';
    const params: { [key: string]: string } = {};

    if (startDate && endDate) {
      dateFilter = 'WHERE created_at >= @startDate AND created_at <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    // Consulta para Ventas Pagadas y Métricas Totales
    const query = `
      SELECT 
        SUM(CASE WHEN financial_status = 'paid' THEN total_price ELSE 0 END) as net_sales,
        COUNT(id) as total_orders,
        COUNTIF(financial_status = 'paid') as paid_orders,
        MAX(currency) as currency
      FROM \`${projectId}.${DATASET_ID}.shopify_orders\`
      ${dateFilter}
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);
    const result = rows[0] || {};

    const netSales = result.net_sales || 0;
    const totalOrders = result.total_orders || 0;
    const paidOrders = result.paid_orders || 0;
    const aov = paidOrders > 0 ? netSales / paidOrders : 0;
    const currency = result.currency || 'USD';

    return NextResponse.json({
      netSales,
      totalOrders,
      paidOrders,
      aov,
      currency
    });
  } catch (error: any) {
    console.error("API Shopify Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
