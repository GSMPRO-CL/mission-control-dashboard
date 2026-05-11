import { NextRequest, NextResponse } from 'next/server';

const SERPAPI = 'https://serpapi.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q    = (searchParams.get('q') || '').trim();
  const date = searchParams.get('date') || 'today 12-m';

  if (!q) {
    return NextResponse.json({ success: false, error: 'Query requerida' }, { status: 400 });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'SERPAPI_KEY no configurada' }, { status: 500 });
  }

  // RELATED_QUERIES only supports one term at a time — fetch each term in parallel
  const terms = q.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const results = await Promise.all(
      terms.map(async term => {
        const url = new URL(`${SERPAPI}/search.json`);
        url.searchParams.set('engine',    'google_trends');
        url.searchParams.set('q',         term);
        url.searchParams.set('date',      date);
        url.searchParams.set('data_type', 'RELATED_QUERIES');
        url.searchParams.set('api_key',   apiKey);

        const res  = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json();

        if (json.error) return { term, data: null, error: json.error };

        // SerpAPI returns related_queries keyed by the term
        const termData = json.related_queries?.[term] ?? json.related_queries ?? {};
        return { term, data: termData };
      }),
    );

    // Build a map: { "iPhone": { top: [...], rising: [...] }, "Samsung": {...} }
    const relatedQueries: Record<string, { top: unknown[]; rising: unknown[] }> = {};
    for (const result of results) {
      if (result.data) {
        relatedQueries[result.term] = {
          top:    result.data.top    ?? [],
          rising: result.data.rising ?? [],
        };
      }
    }

    return NextResponse.json({ success: true, data: { relatedQueries } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
