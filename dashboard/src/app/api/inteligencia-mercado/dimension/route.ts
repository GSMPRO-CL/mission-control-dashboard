import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;

    const query = `
      SELECT
        product_id,
        product_title,
        vendor,
        keyword,
        avg_price,
        avg_monthly_searches,
        last_month_searches,
        avg_potential_buyers,
        last_month_buyers,
        market_size_avg,
        market_size_last,
        market_share_avg,
        market_share_last,
        synced_at
      FROM \`${projectId}.${DATASET_ID}.market_size_metrics\`
      WHERE market_size_avg > 0
      ORDER BY market_size_avg DESC
      LIMIT 200
    `;

    const [rows] = await bq.query({ query });

    // Calcular totales globales (sumatoria)
    const globalMarketSizeAvg  = rows.reduce((s: number, r: any) => s + (r.market_size_avg  || 0), 0);
    const globalMarketSizeLast = rows.reduce((s: number, r: any) => s + (r.market_size_last || 0), 0);
    const globalShareAvg       = rows.reduce((s: number, r: any) => s + (r.market_share_avg  || 0), 0);
    const globalShareLast      = rows.reduce((s: number, r: any) => s + (r.market_share_last || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        globals: {
          totalMarketSizeAvg:  Math.round(globalMarketSizeAvg),
          totalMarketSizeLast: Math.round(globalMarketSizeLast),
          totalShareAvg:       Math.round(globalShareAvg),
          totalShareLast:      Math.round(globalShareLast),
          productCount:        rows.length,
        },
        products: rows.map((r: any) => ({
          ...r,
          synced_at: r.synced_at?.value ?? null,
        })),
      },
    });
  } catch (error: any) {
    console.error('API Market Dimension Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
