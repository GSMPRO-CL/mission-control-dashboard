import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;

    // ── 1. Señales actuales: última señal por marca ───────────────────────────
    const signalsQuery = `
      WITH latest_per_brand AS (
        SELECT
          keyword,
          MAX(trend_date) AS latest_date
        FROM \`${projectId}.${DATASET_ID}.market_trends\`
        WHERE keyword_type = 'brand'
        GROUP BY keyword
      )
      SELECT
        t.keyword,
        t.signal,
        t.signal_detail,
        t.interest_value AS latest_value,
        t.vendor_products,
        t.avg_stock,
        t.trend_date AS last_date
      FROM \`${projectId}.${DATASET_ID}.market_trends\` t
      INNER JOIN latest_per_brand l
        ON t.keyword = l.keyword AND t.trend_date = l.latest_date
      ORDER BY
        CASE t.signal
          WHEN 'breakout' THEN 1
          WHEN 'rising'   THEN 2
          WHEN 'stable'   THEN 3
          WHEN 'falling'  THEN 4
          WHEN 'risk'     THEN 5
          ELSE 6
        END,
        t.interest_value DESC
    `;

    // ── 2. Series históricas: últimas 12 semanas por marca ───────────────────
    const timelineQuery = `
      SELECT
        keyword,
        trend_date,
        interest_value
      FROM \`${projectId}.${DATASET_ID}.market_trends\`
      WHERE
        keyword_type = 'brand'
        AND trend_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 84 DAY)
      ORDER BY keyword, trend_date ASC
    `;

    const [[signals], [timeline]] = await Promise.all([
      bq.query({ query: signalsQuery }),
      bq.query({ query: timelineQuery }),
    ]);

    // Agrupar timeline por marca para el frontend
    const timelineByBrand: Record<string, Array<{ date: string; value: number }>> = {};
    for (const row of timeline as any[]) {
      const key = row.keyword;
      if (!timelineByBrand[key]) timelineByBrand[key] = [];
      timelineByBrand[key].push({
        date:  row.trend_date?.value ?? String(row.trend_date),
        value: row.interest_value,
      });
    }

    // KPIs globales
    const signalRows = signals as any[];
    const breakouts = signalRows.filter(r => r.signal === 'breakout').length;
    const rising    = signalRows.filter(r => r.signal === 'rising').length;
    const atRisk    = signalRows.filter(r => r.signal === 'risk').length;
    const avgIndex  = signalRows.length > 0
      ? Math.round(signalRows.reduce((s, r) => s + r.latest_value, 0) / signalRows.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        summary: { breakouts, rising, atRisk, totalBrands: signalRows.length, avgIndex },
        signals: signalRows.map(r => ({
          ...r,
          last_date: r.last_date?.value ?? String(r.last_date),
        })),
        timeline: timelineByBrand,
      },
    });
  } catch (error: any) {
    console.error('API Tendencias Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
