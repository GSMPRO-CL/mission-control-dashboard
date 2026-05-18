import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!productId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Obtener KPIs globales y tendencia para el producto cruzando por handle
    const trendQuery = `
      WITH ProductData AS (
        SELECT id, handle, title, vendor
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\`
        WHERE id = @productId
        LIMIT 1
      )
      SELECT 
        CAST(g.date AS STRING) as date,
        SUM(g.clicks) as clicks,
        SUM(g.impressions) as impressions,
        SUM(g.position * g.impressions) / NULLIF(SUM(g.impressions), 0) as avg_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` g
      CROSS JOIN ProductData p
      WHERE g.page LIKE CONCAT('%/products/', p.handle, '%')
        AND g.date >= @startDate AND g.date <= @endDate
      GROUP BY g.date
      ORDER BY g.date ASC
    `;

    // 2. Top Queries para el producto
    const queriesQuery = `
      WITH ProductData AS (
        SELECT id, handle
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\`
        WHERE id = @productId
        LIMIT 1
      )
      SELECT 
        g.query,
        SUM(g.clicks) as clicks,
        SUM(g.impressions) as impressions,
        SUM(g.position * g.impressions) / NULLIF(SUM(g.impressions), 0) as avg_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` g
      CROSS JOIN ProductData p
      WHERE g.page LIKE CONCAT('%/products/', p.handle, '%')
        AND g.date >= @startDate AND g.date <= @endDate
      GROUP BY g.query
      ORDER BY clicks DESC, impressions DESC
      LIMIT 20
    `;

    const params = {
      productId: parseInt(productId, 10),
      startDate,
      endDate
    };

    const [[trendRows], [queryRows]] = await Promise.all([
      bigquery.query({ query: trendQuery, params }),
      bigquery.query({ query: queriesQuery, params })
    ]);

    // Calcular KPIs agregados
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
        topQueries
      }
    });

  } catch (error: any) {
    console.error('Error fetching Product SEO Position:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch product SEO data' }, { status: 500 });
  }
}
