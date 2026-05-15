import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = process.env.GCP_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID is not configured');
    }

    // Parse date parameters, default to last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam)))
      ? new Date(startDateParam)
      : thirtyDaysAgo;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam)))
      ? new Date(endDateParam)
      : now;

    // Format dates for BigQuery (YYYY-MM-DD)
    const formatBqDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const start = formatBqDate(startDate);
    const end = formatBqDate(endDate);

    const bigquery = new BigQuery({ projectId });

    // 1. Overall KPIs Query
    const kpisQuery = `
      SELECT
        SUM(sessions) as total_sessions,
        SUM(total_users) as total_users,
        SUM(new_users) as new_users,
        SUM(conversions) as conversions,
        SUM(ecommerce_purchases) as ecommerce_purchases,
        SUM(purchase_revenue) as purchase_revenue,
        SUM(add_to_carts) as add_to_carts,
        AVG(engagement_rate) as avg_engagement_rate,
        AVG(average_session_duration) as avg_session_duration
      FROM \`${projectId}.ecommerce_data.raw_traffic_ga4\`
      WHERE date BETWEEN @start AND @end
    `;

    // 2. Trend by Date Query
    const trendQuery = `
      SELECT
        CAST(date AS STRING) as date,
        SUM(sessions) as sessions,
        SUM(total_users) as users,
        SUM(conversions) as conversions,
        SUM(purchase_revenue) as revenue
      FROM \`${projectId}.ecommerce_data.raw_traffic_ga4\`
      WHERE date BETWEEN @start AND @end
      GROUP BY date
      ORDER BY date ASC
    `;

    // 3. Channel Grouping Breakdown
    const channelsQuery = `
      SELECT
        session_default_channel_group as channel,
        SUM(sessions) as sessions,
        SUM(total_users) as users,
        SUM(conversions) as conversions,
        SUM(purchase_revenue) as revenue
      FROM \`${projectId}.ecommerce_data.raw_traffic_ga4\`
      WHERE date BETWEEN @start AND @end
      GROUP BY channel
      ORDER BY sessions DESC
    `;

    // 4. Source/Medium Breakdown
    const sourceMediumQuery = `
      SELECT
        session_source_medium as source_medium,
        SUM(sessions) as sessions,
        SUM(conversions) as conversions,
        SUM(purchase_revenue) as revenue
      FROM \`${projectId}.ecommerce_data.raw_traffic_ga4\`
      WHERE date BETWEEN @start AND @end
      GROUP BY source_medium
      ORDER BY sessions DESC
      LIMIT 15
    `;

    const options = {
      params: { start, end }
    };

    const [[kpisRows], [trendRows], [channelsRows], [sourceMediumRows]] = await Promise.all([
      bigquery.query({ query: kpisQuery, ...options }),
      bigquery.query({ query: trendQuery, ...options }),
      bigquery.query({ query: channelsQuery, ...options }),
      bigquery.query({ query: sourceMediumQuery, ...options })
    ]);

    const kpis = kpisRows && kpisRows.length > 0 ? kpisRows[0] : null;

    // Format the response data
    const data = {
      dateRange: { startDate: start, endDate: end },
      kpis: kpis ? {
        sessions: kpis.total_sessions || 0,
        totalUsers: kpis.total_users || 0,
        newUsers: kpis.new_users || 0,
        conversions: kpis.conversions || 0,
        ecommercePurchases: kpis.ecommerce_purchases || 0,
        purchaseRevenue: kpis.purchase_revenue || 0,
        addToCarts: kpis.add_to_carts || 0,
        avgEngagementRate: kpis.avg_engagement_rate ? Number(kpis.avg_engagement_rate).toFixed(4) : 0,
        avgSessionDuration: kpis.avg_session_duration || 0,
      } : null,
      trend: trendRows.map((row: any) => ({
        date: row.date,
        sessions: row.sessions || 0,
        users: row.users || 0,
        conversions: row.conversions || 0,
        revenue: row.revenue || 0
      })),
      channels: channelsRows.map((row: any) => ({
        channel: row.channel || '(Not Set)',
        sessions: row.sessions || 0,
        users: row.users || 0,
        conversions: row.conversions || 0,
        revenue: row.revenue || 0
      })),
      sources: sourceMediumRows.map((row: any) => ({
        sourceMedium: row.source_medium || '(Not Set)',
        sessions: row.sessions || 0,
        conversions: row.conversions || 0,
        revenue: row.revenue || 0
      }))
    };

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('API GA4 Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch GA4 data' },
      { status: 500 }
    );
  }
}
