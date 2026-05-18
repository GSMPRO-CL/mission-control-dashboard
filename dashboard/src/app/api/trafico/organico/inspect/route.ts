import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { fetchCloudRun } from '@/lib/cloud-run-client';

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productId, metric, startDate, endDate } = body;

    if (!productId || !startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Obtener la info del producto y sus métricas SEO
    const productQuery = `
      WITH ProductData AS (
        SELECT id, handle, title, vendor
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\`
        WHERE id = @productId
        LIMIT 1
      ),
      GscData AS (
        SELECT 
          SUM(g.clicks) as clicks,
          SUM(g.impressions) as impressions,
          SUM(g.position * g.impressions) / NULLIF(SUM(g.impressions), 0) as avg_position
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` g
        CROSS JOIN ProductData p
        WHERE g.page LIKE CONCAT('%/products/', p.handle, '%')
          AND g.date >= @startDate AND g.date <= @endDate
      )
      SELECT 
        p.title, p.handle, p.vendor,
        g.clicks, g.impressions, g.avg_position
      FROM ProductData p
      CROSS JOIN GscData g
    `;

    // Top Queries
    const queriesQuery = `
      WITH ProductData AS (
        SELECT handle
        FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\`
        WHERE id = @productId
        LIMIT 1
      )
      SELECT g.query, SUM(g.clicks) as clicks, SUM(g.impressions) as impressions, SUM(g.position * g.impressions)/NULLIF(SUM(g.impressions),0) as position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\` g
      CROSS JOIN ProductData p
      WHERE g.page LIKE CONCAT('%/products/', p.handle, '%')
        AND g.date >= @startDate AND g.date <= @endDate
      GROUP BY g.query
      ORDER BY clicks DESC, impressions DESC
      LIMIT 10
    `;

    // Benchmark global
    const benchmarkQuery = `
      SELECT 
        SUM(clicks) / NULLIF(SUM(impressions), 0) * 100 as site_ctr,
        SUM(position * impressions) / NULLIF(SUM(impressions), 0) as site_position
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.gsc_metrics\`
      WHERE date >= @startDate AND date <= @endDate
    `;

    const params = { productId: parseInt(productId, 10), startDate, endDate };

    const [[productRows], [queryRows], [benchmarkRows]] = await Promise.all([
      bigquery.query({ query: productQuery, params }),
      bigquery.query({ query: queriesQuery, params }),
      bigquery.query({ query: benchmarkQuery, params })
    ]);

    if (!productRows || productRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const p = productRows[0];
    const b = benchmarkRows[0];

    const payload = {
      product: {
        title: p.title,
        handle: p.handle,
        url: `https://${process.env.SHOPIFY_DOMAIN}/products/${p.handle}`,
        clicks: p.clicks || 0,
        impressions: p.impressions || 0,
        ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
        position: p.avg_position || 0
      },
      queries: queryRows.map(r => ({
        query: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
        ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0
      })),
      benchmark: {
        site_ctr: b.site_ctr || 0,
        site_position: b.site_position || 0
      },
      selected_metric: metric || 'Todas'
    };

    // 2. Llamar al microservicio Python
    const aiResponse = await fetchCloudRun('/api/v1/seo/analyze', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Service Error:', errText);
      return NextResponse.json({ success: false, error: 'AI Analysis failed' }, { status: 500 });
    }

    const aiData = await aiResponse.json();

    return NextResponse.json({ success: true, data: aiData });

  } catch (error: any) {
    console.error('Error in SEO Inspector API:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
