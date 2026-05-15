import { NextRequest, NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { v4 as uuidv4 } from 'uuid';

const bq = new BigQuery();
const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'competitor_prices';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, title, ourPrice, competitors, keyword } = body;

    if (!title || ourPrice === undefined || !Array.isArray(competitors)) {
      return NextResponse.json({ success: false, error: 'Datos insuficientes para guardar' }, { status: 400 });
    }

    const rows = competitors.map((c: any) => ({
      record_id: uuidv4(),
      product_id: productId || 0, // 0 if not mapped to a specific internal product
      product_title: title,
      vendor: null,
      keyword_searched: keyword || title,
      
      our_price: ourPrice,
      
      competitor_name: c.source || 'Desconocido',
      competitor_title: c.title || 'Desconocido',
      competitor_price: c.extractedPrice || 0,
      has_stock: true, // Assuming stock if it appears in Google Shopping
      competitor_url: c.link || null,
      thumbnail_url: c.thumbnail || null,

      price_diff_amount: c.diffAmount,
      price_diff_pct: c.diffPct,
      is_competitive: c.isCompetitive,
      
      data_source: 'serpapi_shopping_manual',
      synced_at: new Date().toISOString(),
    }));

    if (rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay competidores para guardar' });
    }

    await bq.dataset(DATASET_ID).table(TABLE_ID).insert(rows);

    return NextResponse.json({ success: true, message: 'Búsqueda guardada en BigQuery' });
  } catch (err: any) {
    console.error('Error guardando en BQ:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
