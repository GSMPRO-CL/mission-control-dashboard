import { NextRequest, NextResponse } from 'next/server';
import { bq } from '@/lib/bigquery';

export async function GET(req: NextRequest) {
  try {
    const query = `
      WITH latest_scans AS (
        SELECT 
          keyword,
          product_id,
          organic_position,
          paid_position,
          top_competitor_name,
          top_competitor_price,
          scan_date,
          scraped_at,
          ROW_NUMBER() OVER (PARTITION BY keyword ORDER BY scan_date DESC, scraped_at DESC) as rn
        FROM \`raw_layer.shopping_position\`
      ),
      previous_scans AS (
        SELECT
          keyword,
          organic_position,
          paid_position,
          ROW_NUMBER() OVER (PARTITION BY keyword ORDER BY scan_date DESC, scraped_at DESC) as rn
        FROM \`raw_layer.shopping_position\`
      ),
      history_data AS (
        SELECT
          keyword,
          ARRAY_AGG(
            STRUCT(
              scan_date, 
              organic_position, 
              paid_position
            ) ORDER BY scan_date ASC
          ) as history
        FROM \`raw_layer.shopping_position\`
        WHERE scan_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY)
        GROUP BY keyword
      )
      SELECT 
        l.keyword,
        l.product_id,
        l.organic_position,
        l.paid_position,
        l.top_competitor_name,
        l.top_competitor_price,
        l.scan_date,
        l.scraped_at,
        p.organic_position as prev_organic_position,
        p.paid_position as prev_paid_position,
        h.history
      FROM latest_scans l
      LEFT JOIN previous_scans p ON l.keyword = p.keyword AND p.rn = 2
      LEFT JOIN history_data h ON l.keyword = h.keyword
      WHERE l.rn = 1
      ORDER BY l.keyword
    `;

    const [rows] = await bq.query({ query });

    return NextResponse.json({
      success: true,
      data: rows.map(r => ({
        keyword: r.keyword,
        product_id: r.product_id,
        organic_position: r.organic_position,
        paid_position: r.paid_position,
        top_competitor_name: r.top_competitor_name,
        top_competitor_price: r.top_competitor_price,
        scan_date: r.scan_date ? r.scan_date.value : null,
        scraped_at: r.scraped_at ? r.scraped_at.value : null,
        prev_organic_position: r.prev_organic_position,
        prev_paid_position: r.prev_paid_position,
        history: r.history ? r.history.map((h: any) => ({
          scan_date: h.scan_date ? h.scan_date.value : null,
          organic_position: h.organic_position,
          paid_position: h.paid_position
        })) : []
      }))
    });

  } catch (err: any) {
    console.error('Error fetching shopping position:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
