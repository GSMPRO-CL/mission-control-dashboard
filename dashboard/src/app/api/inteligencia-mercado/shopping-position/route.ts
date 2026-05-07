import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  try {
    const projectId   = process.env.GCP_PROJECT_ID;
    const { searchParams } = new URL(request.url);
    const adType      = searchParams.get('adType') === 'organic' ? 'organic' : 'paid';

    // ── 1. Resumen de la última ejecución por ad_type ─────────────────────────
    const summaryQuery = `
      WITH latest_run AS (
        SELECT run_id, MAX(scanned_at) AS last_scan
        FROM \`${projectId}.${DATASET_ID}.shopping_positions\`
        WHERE ad_type = @adType
        GROUP BY run_id
        ORDER BY last_scan DESC
        LIMIT 1
      )
      SELECT
        sp.keyword,
        sp.gsmpro_position,
        sp.gsmpro_appeared,
        sp.gsmpro_title,
        sp.gsmpro_price,
        sp.competitor_rank,
        sp.competitor_name,
        sp.competitor_title,
        sp.competitor_price,
        sp.is_exact_match,
        FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', sp.scanned_at) AS scanned_at,
        sp.run_id
      FROM \`${projectId}.${DATASET_ID}.shopping_positions\` sp
      INNER JOIN latest_run lr ON sp.run_id = lr.run_id
      ORDER BY sp.keyword, sp.competitor_rank ASC
    `;

    // ── 2. Historial de posición promedio (últimas 30 ejecuciones) ────────────
    const historyQuery = `
      SELECT
        FORMAT_TIMESTAMP('%m-%d %H:%M', MIN(scanned_at)) AS scan_label,
        run_id,
        ROUND(AVG(IF(gsmpro_position IS NOT NULL, gsmpro_position, NULL)), 1) AS avg_position,
        COUNTIF(gsmpro_appeared) AS keywords_visible,
        COUNT(DISTINCT keyword) AS total_keywords
      FROM \`${projectId}.${DATASET_ID}.shopping_positions\`
      WHERE ad_type = @adType
      GROUP BY run_id
      ORDER BY MIN(scanned_at) DESC
      LIMIT 30
    `;

    const queryOptions = { params: { adType } };
    const [[rawRows], [historyRows]] = await Promise.all([
      bq.query({ query: summaryQuery, ...queryOptions }),
      bq.query({ query: historyQuery, ...queryOptions }),
    ]);

    // Agrupar por keyword para el frontend
    const keywordMap = new Map<string, any>();
    for (const row of rawRows as any[]) {
      const kw = row.keyword;
      if (!keywordMap.has(kw)) {
        keywordMap.set(kw, {
          keyword:         kw,
          gsmpro_position: row.gsmpro_position,
          gsmpro_appeared: row.gsmpro_appeared,
          gsmpro_title:    row.gsmpro_title,
          gsmpro_price:    row.gsmpro_price,
          scanned_at:      row.scanned_at,
          competitors:     [],
        });
      }
      if (row.competitor_rank != null) {
        keywordMap.get(kw).competitors.push({
          rank:          row.competitor_rank,
          name:          row.competitor_name,
          title:         row.competitor_title,
          price:         row.competitor_price,
          is_exact_match: row.is_exact_match,
        });
      }
    }

    const keywords = Array.from(keywordMap.values())
      .sort((a, b) => (a.gsmpro_position ?? 99) - (b.gsmpro_position ?? 99));

    // KPIs globales
    const appeared    = keywords.filter(k => k.gsmpro_appeared).length;
    const avgPosition = keywords.filter(k => k.gsmpro_position != null).length > 0
      ? Math.round(keywords.filter(k => k.gsmpro_position != null)
          .reduce((s, k) => s + k.gsmpro_position, 0)
          / keywords.filter(k => k.gsmpro_position != null).length * 10) / 10
      : null;
    const visibilityRate = keywords.length > 0
      ? Math.round((appeared / keywords.length) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        adType,
        summary: {
          totalKeywords:  keywords.length,
          appeared,
          visibilityRate,
          avgPosition,
          lastScan: keywords[0]?.scanned_at ?? null,
        },
        keywords,
        history: (historyRows as any[]).reverse().map(r => ({
          label:           r.scan_label,
          avgPosition:     r.avg_position,
          keywordsVisible: r.keywords_visible,
          totalKeywords:   r.total_keywords,
        })),
      },
    });
  } catch (error: any) {
    console.error('API Shopping Position Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
