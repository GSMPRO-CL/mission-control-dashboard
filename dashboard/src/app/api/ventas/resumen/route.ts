import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Default to MTD if no dates provided
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam))) ? new Date(startDateParam) : firstDayOfMonth;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam))) ? new Date(endDateParam) : now;

    // Calculate difference in days for daily average (minimum 1 to avoid division by zero)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const projectId = process.env.GCP_PROJECT_ID;

    // Q1: KPIs Agregados and Q2: Tendencia (from the same view to minimize distinct queries where possible, but we'll fetch trend and aggregate it here, or use two queries)
    // Actually, following the plan, let's fetch trend and aggregate here to save a query, or run the exact 3 queries.
    // Plan says:
    // Q1: KPIs Agregados (v_ventas_daily_summary)
    // Q2: Tendencia Diaria (v_ventas_daily_summary)
    // Q3: Top 5 Productos + Top 5 Marcas
    
    // We can fetch the trend and just sum it up for the KPIs.
    const queryTrend = `
      SELECT
        CAST(sale_date AS STRING) as date,
        net_sales,
        gross_sales,
        net_orders,
        gross_orders,
        total_discounts,
        paid_count,
        pending_count,
        refunded_count,
        partially_refunded_count,
        other_count
      FROM \`${projectId}.${DATASET_ID}.v_ventas_daily_summary\`
      WHERE sale_date >= DATE(@startDate) AND sale_date <= DATE(@endDate)
      ORDER BY sale_date ASC
    `;

    // Q3: Top Products and Brands (We can get them in one query using two separate statements if supported, or two queries. Plan says 3 queries total is fine).
    // Let's do 3 queries for simplicity and parallelization: Trend (which we aggregate for KPIs), Top Products, Top Brands.
    
    const queryTopProducts = `
      WITH TopSelling AS (
        SELECT
          L.product_id,
          L.title as product_title,
          COALESCE(L.vendor, 'Desconocido') as brand,
          SUM(L.quantity) as quantity_sold,
          SUM(CAST(L.price AS FLOAT64) * L.quantity) as gross_revenue
        FROM \`${projectId}.${DATASET_ID}.shopify_order_lines\` L
        JOIN \`${projectId}.${DATASET_ID}.shopify_orders\` O 
          ON L.order_id = O.id
        WHERE O.created_at >= TIMESTAMP(@startDate) AND O.created_at <= TIMESTAMP(@endDate)
          AND O.financial_status IN ('paid', 'partially_refunded')
        GROUP BY L.product_id, L.title, L.vendor
        ORDER BY gross_revenue DESC
        LIMIT 5
      )
      SELECT 
        T.product_title as title,
        T.brand,
        T.quantity_sold as quantity,
        T.gross_revenue as revenue
      FROM TopSelling T
      ORDER BY T.gross_revenue DESC
    `;

    const queryTopBrands = `
      SELECT
        COALESCE(L.vendor, 'Desconocido') as brand,
        SUM(L.quantity) as quantity,
        SUM(CAST(L.price AS FLOAT64) * L.quantity) as revenue
      FROM \`${projectId}.${DATASET_ID}.shopify_order_lines\` L
      JOIN \`${projectId}.${DATASET_ID}.shopify_orders\` O 
        ON L.order_id = O.id
      WHERE O.created_at >= TIMESTAMP(@startDate) AND O.created_at <= TIMESTAMP(@endDate)
        AND O.financial_status IN ('paid', 'partially_refunded')
      GROUP BY L.vendor
      ORDER BY revenue DESC
      LIMIT 5
    `;

    const params = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };

    const [[trendRows], [topProducts], [topBrands]] = await Promise.all([
      bq.query({ query: queryTrend, params }),
      bq.query({ query: queryTopProducts, params }),
      bq.query({ query: queryTopBrands, params })
    ]);

    // Aggregate KPIs from trend rows
    let netSales = 0;
    let grossSales = 0;
    let netOrderCount = 0;
    let grossOrderCount = 0;
    let totalDiscounts = 0;

    let paid_count = 0;
    let pending_count = 0;
    let refunded_count = 0;
    let partially_refunded_count = 0;
    let other_count = 0;

    const trend = trendRows.map(r => {
      const rowNetSales = parseFloat(r.net_sales) || 0;
      const rowGrossSales = parseFloat(r.gross_sales) || 0;
      const rowNetOrders = parseInt(r.net_orders, 10) || 0;
      const rowGrossOrders = parseInt(r.gross_orders, 10) || 0;
      const rowDiscounts = parseFloat(r.total_discounts) || 0;

      netSales += rowNetSales;
      grossSales += rowGrossSales;
      netOrderCount += rowNetOrders;
      grossOrderCount += rowGrossOrders;
      totalDiscounts += rowDiscounts;

      paid_count += parseInt(r.paid_count, 10) || 0;
      pending_count += parseInt(r.pending_count, 10) || 0;
      refunded_count += parseInt(r.refunded_count, 10) || 0;
      partially_refunded_count += parseInt(r.partially_refunded_count, 10) || 0;
      other_count += parseInt(r.other_count, 10) || 0;

      return {
        date: r.date,
        netSales: rowNetSales,
        orders: rowGrossOrders // Note: plan says 'orders' daily. We'll use gross orders for volume perspective, or net orders. Let's use netOrders to align with netSales.
      };
    });

    const aov = netOrderCount > 0 ? netSales / netOrderCount : 0;
    const avgDailySales = netSales / diffDays;

    const paymentStatuses = [
      { name: 'Paid', value: paid_count, amount: 0 }, // Amount is not easily aggregated without joining total_price, but we'll use value for the pie chart
      { name: 'Pending', value: pending_count, amount: 0 },
      { name: 'Refunded', value: refunded_count, amount: 0 },
      { name: 'Partially Refunded', value: partially_refunded_count, amount: 0 },
      { name: 'Other', value: other_count, amount: 0 }
    ].filter(s => s.value > 0);

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          netSales,
          grossSales,
          netOrderCount,
          grossOrderCount,
          aov,
          avgDailySales,
          totalDiscounts
        },
        trend: trendRows.map(r => ({
          date: r.date,
          netSales: parseFloat(r.net_sales) || 0,
          orders: parseInt(r.net_orders, 10) || 0 // matching net sales and net orders
        })),
        paymentStatuses,
        topProducts: topProducts.map(p => ({
          title: p.title,
          brand: p.brand,
          quantity: parseInt(p.quantity, 10) || 0,
          revenue: parseFloat(p.revenue) || 0
        })),
        topBrands: topBrands.map(b => ({
          brand: b.brand,
          quantity: parseInt(b.quantity, 10) || 0,
          revenue: parseFloat(b.revenue) || 0
        }))
      }
    });

  } catch (error: any) {
    console.error('API Ventas Resumen Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
