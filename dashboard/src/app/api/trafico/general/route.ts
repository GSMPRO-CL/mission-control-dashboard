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

    const startDateStr = startDateParam || firstDayOfMonth.toISOString().split('T')[0];
    const endDateStr = endDateParam || now.toISOString().split('T')[0];

    const query = `
      SELECT
        CAST(t.date AS STRING) as date,
        t.total_sessions,
        t.unique_visitors,
        t.pageviews,
        t.bounce_rate,
        COUNT(o.id) as orders
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_traffic_daily\` t
      LEFT JOIN \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_orders\` o
        ON DATE(o.created_at) = t.date 
        AND o.financial_status IN ('paid', 'partially_refunded')
      WHERE t.date >= @startDate AND t.date <= @endDate
      GROUP BY t.date, t.total_sessions, t.unique_visitors, t.pageviews, t.bounce_rate
      ORDER BY t.date ASC
    `;

    const options = {
      query: query,
      params: {
        startDate: startDateStr,
        endDate: endDateStr
      }
    };

    const [rows] = await bigquery.query(options);

    let sumSessions = 0;
    let sumVisitors = 0;
    let sumPageviews = 0;
    let sumBounceRate = 0;
    let sumOrders = 0;

    const trend = rows.map(row => {
      const sessions = parseInt(row.total_sessions, 10) || 0;
      const visitors = parseInt(row.unique_visitors, 10) || 0;
      const pageviews = parseInt(row.pageviews, 10) || 0;
      const bounce = parseFloat(row.bounce_rate) || 0;
      const orders = parseInt(row.orders, 10) || 0;

      sumSessions += sessions;
      sumVisitors += visitors;
      sumPageviews += pageviews;
      sumBounceRate += bounce;
      sumOrders += orders;

      return {
        date: row.date,
        sessions,
        visitors,
        pageviews,
        bounceRate: bounce,
        orders,
        conversionRate: sessions > 0 ? (orders / sessions) * 100 : 0
      };
    });

    const daysCount = rows.length || 1;
    const avgBounceRate = sumBounceRate / daysCount;
    const avgConversionRate = sumSessions > 0 ? (sumOrders / sumSessions) * 100 : 0;

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          totalSessions: sumSessions,
          uniqueVisitors: sumVisitors,
          totalPageviews: sumPageviews,
          avgBounceRate,
          avgConversionRate,
          totalOrders: sumOrders
        },
        trend
      }
    });

  } catch (error) {
    console.error('Error fetching General Traffic:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch traffic data' }, { status: 500 });
  }
}
