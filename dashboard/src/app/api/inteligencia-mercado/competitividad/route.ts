import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const { searchParams } = new URL(request.url);
    const vendorFilter = searchParams.get('vendor');

    // Construir filtro de vendor si se especifica
    const vendorClause = vendorFilter
      ? `AND vendor = @vendor`
      : '';

    const params: Record<string, string> = {};
    if (vendorFilter) params.vendor = vendorFilter;

    // Obtener la snapshot más reciente por producto+competidor
    // (la última fecha de sync disponible)
    const query = `
      WITH latest_sync AS (
        SELECT MAX(DATE(synced_at)) AS last_date
        FROM \`${projectId}.${DATASET_ID}.competitor_prices\`
      ),
      latest_records AS (
        SELECT cp.*
        FROM \`${projectId}.${DATASET_ID}.competitor_prices\` cp
        CROSS JOIN latest_sync
        WHERE DATE(cp.synced_at) = latest_sync.last_date
          ${vendorClause}
      )
      SELECT
        product_id,
        product_title,
        vendor,
        keyword_searched,
        our_price,
        competitor_name,
        competitor_title,
        competitor_price,
        has_stock,
        competitor_url,
        thumbnail_url,
        price_diff_amount,
        price_diff_pct,
        is_competitive,
        data_source,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', synced_at) AS synced_at
      FROM latest_records
      ORDER BY product_title, price_diff_pct ASC
    `;

    const [rows] = await bq.query({ query, params });

    // ── Calcular KPIs globales ────────────────────────────────────────────────
    const uniqueProducts = new Set(rows.map((r: any) => r.product_id)).size;
    const competitiveRows = rows.filter((r: any) => r.is_competitive);
    const inStockCompetitors = rows.filter((r: any) => r.has_stock).length;
    const outOfStockCompetitors = rows.filter((r: any) => !r.has_stock).length;

    // % de comparaciones donde somos competitivos
    const competitivenessRate = rows.length > 0
      ? Math.round((competitiveRows.length / rows.length) * 100)
      : 0;

    // Promedio de diferencia de precio
    const avgPriceDiffPct = rows.length > 0
      ? Math.round(rows.reduce((s: number, r: any) => s + (r.price_diff_pct || 0), 0) / rows.length * 10) / 10
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalComparisons:    rows.length,
          uniqueProducts,
          competitivenessRate,
          avgPriceDiffPct,
          inStockCompetitors,
          outOfStockCompetitors,
          lastSync: rows[0]?.synced_at ?? null,
        },
        competitors: rows,
      },
    });
  } catch (error: any) {
    console.error('API Competitividad Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
