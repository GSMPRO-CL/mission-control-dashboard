import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Default to MTD (Month to Date) if no dates provided
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam))) ? new Date(startDateParam) : firstDayOfMonth;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam))) ? new Date(endDateParam) : now;

    // Calculate difference in days for daily average (minimum 1 to avoid division by zero)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const query = `
      SELECT
        SUM(total_price) as gross_sales,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) as net_sales,
        COUNT(id) as gross_order_count,
        COUNT(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN id END) as net_order_count,
        SUM(total_discounts) as total_discounts,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_discounts ELSE 0 END) as net_discounts
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
    `;

    const options = {
      query: query,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const trendQuery = `
      SELECT
        CAST(DATE(created_at) AS STRING) as date,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) as net_sales,
        SUM(total_price) as gross_sales,
        COUNT(id) as orders
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
      GROUP BY date
      ORDER BY date ASC
    `;

    const trendOptions = {
      query: trendQuery,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const statusQuery = `
      SELECT
        COALESCE(financial_status, 'unknown') as status,
        COUNT(id) as count,
        SUM(total_price) as value
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
      GROUP BY status
      ORDER BY count DESC
    `;

    const statusOptions = {
      query: statusQuery,
      params: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    };

    const [[rows], [trendRows], [statusRows]] = await Promise.all([
      bigquery.query(options),
      bigquery.query(trendOptions),
      bigquery.query(statusOptions)
    ]);
    const result = rows[0] || {};

    const grossSales = parseFloat(result.gross_sales) || 0;
    const netSales = parseFloat(result.net_sales) || 0;
    const grossOrderCount = parseInt(result.gross_order_count, 10) || 0;
    const netOrderCount = parseInt(result.net_order_count, 10) || 0;
    const totalDiscounts = parseFloat(result.total_discounts) || 0;
    const netDiscounts = parseFloat(result.net_discounts) || 0;

    const aov = netOrderCount > 0 ? netSales / netOrderCount : 0;
    const averageDailySales = netSales / diffDays;

    const trend = trendRows.map(row => ({
      date: row.date,
      netSales: parseFloat(row.net_sales) || 0,
      grossSales: parseFloat(row.gross_sales) || 0,
      orders: parseInt(row.orders, 10) || 0
    }));

    const paymentStatuses = statusRows.map(row => ({
      name: row.status,
      value: parseInt(row.count, 10) || 0,
      amount: parseFloat(row.value) || 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        dateRange: { startDate, endDate, diffDays },
        kpis: {
          grossSales,
          netSales,
          grossOrderCount,
          netOrderCount,
          totalDiscounts,
          netDiscounts,
          aov,
          averageDailySales
        },
        trend,
        paymentStatuses
      }
    });

  } catch (error) {
    console.error('Error fetching Sales KPIs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch sales data' }, { status: 500 });
  }
}
