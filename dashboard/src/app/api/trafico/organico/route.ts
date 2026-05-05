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

    // 1. Trend and Global KPIs
    const trendQuery = `
      SELECT
        CAST(date AS STRING) as date,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        SUM(position * impressions) / NULLIF(SUM(impressions), 0) as avg_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\`
      WHERE date >= @startDate AND date <= @endDate
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Top Queries
    const queriesQuery = `
      SELECT
        query,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        SUM(position * impressions) / NULLIF(SUM(impressions), 0) as avg_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\`
      WHERE date >= @startDate AND date <= @endDate
      GROUP BY query
      ORDER BY clicks DESC
      LIMIT 100
    `;

    // 3. Top Pages
    const pagesQuery = `
      SELECT
        page,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        SUM(position * impressions) / NULLIF(SUM(impressions), 0) as avg_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\`
      WHERE date >= @startDate AND date <= @endDate
      GROUP BY page
      ORDER BY clicks DESC
      LIMIT 50
    `;

    const params = {
      startDate: startDateStr,
      endDate: endDateStr
    };

    const [[trendRows], [queryRows], [pageRows]] = await Promise.all([
      bigquery.query({ query: trendQuery, params }),
      bigquery.query({ query: queriesQuery, params }),
      bigquery.query({ query: pagesQuery, params })
    ]);

    // Aggregate global KPIs from trend
    let totalClicks = 0;
    let totalImpressions = 0;
    let sumPosImp = 0;

    const trend = trendRows.map(row => {
      const c = parseInt(row.clicks, 10) || 0;
      const i = parseInt(row.impressions, 10) || 0;
      const pos = parseFloat(row.avg_position) || 0;

      totalClicks += c;
      totalImpressions += i;
      sumPosImp += (pos * i);

      return {
        date: row.date,
        clicks: c,
        impressions: i,
        ctr: i > 0 ? (c / i) * 100 : 0,
        position: pos
      };
    });

    const globalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const globalAvgPosition = totalImpressions > 0 ? (sumPosImp / totalImpressions) : 0;

    const topQueries = queryRows.map(row => ({
      query: row.query,
      clicks: parseInt(row.clicks, 10) || 0,
      impressions: parseInt(row.impressions, 10) || 0,
      ctr: parseInt(row.impressions, 10) > 0 ? ((parseInt(row.clicks, 10) || 0) / parseInt(row.impressions, 10)) * 100 : 0,
      position: parseFloat(row.avg_position) || 0
    }));

    const topPages = pageRows.map(row => ({
      page: row.page,
      clicks: parseInt(row.clicks, 10) || 0,
      impressions: parseInt(row.impressions, 10) || 0,
      ctr: parseInt(row.impressions, 10) > 0 ? ((parseInt(row.clicks, 10) || 0) / parseInt(row.impressions, 10)) * 100 : 0,
      position: parseFloat(row.avg_position) || 0
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpis: {
          clicks: totalClicks,
          impressions: totalImpressions,
          ctr: globalCtr,
          position: globalAvgPosition
        },
        trend,
        topQueries,
        topPages
      }
    });

  } catch (error) {
    console.error('Error fetching Organic Traffic:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch organic traffic data' }, { status: 500 });
  }
}
