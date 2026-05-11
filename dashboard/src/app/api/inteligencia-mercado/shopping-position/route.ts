import { NextRequest, NextResponse } from 'next/server';

const SERPAPI = 'https://serpapi.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q       = (searchParams.get('q')       || '').trim();
  const brand   = (searchParams.get('brand')   || 'GSMPRO').trim();
  const country = (searchParams.get('country') || 'us').toLowerCase();

  if (!q) {
    return NextResponse.json({ success: false, error: 'Query requerida (?q=keyword)' }, { status: 400 });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'SERPAPI_KEY no configurada' }, { status: 500 });
  }

  try {
    const url = new URL(`${SERPAPI}/search.json`);
    url.searchParams.set('engine',  'google_shopping');
    url.searchParams.set('q',       q);
    url.searchParams.set('gl',      country);
    url.searchParams.set('hl',      'es');
    url.searchParams.set('num',     '40');
    url.searchParams.set('api_key', apiKey);

    const accountUrl = new URL(`${SERPAPI}/account.json`);
    accountUrl.searchParams.set('api_key', apiKey);

    const [shoppingRes, accountRes] = await Promise.all([
      fetch(url.toString(),        { cache: 'no-store' }),
      fetch(accountUrl.toString(), { cache: 'no-store' }),
    ]);

    const [json, accountJson] = await Promise.all([
      shoppingRes.json(),
      accountRes.json(),
    ]);

    if (json.error) {
      return NextResponse.json({ success: false, error: json.error }, { status: 400 });
    }

    const brandLower = brand.toLowerCase();

    const organic: any[] = json.shopping_results ?? [];
    const paid:    any[] = json.ads_results       ?? [];

    const findBrand = (results: any[]) =>
      results.findIndex(r => (r.source ?? '').toLowerCase().includes(brandLower));

    const organicPos = findBrand(organic);
    const paidPos    = findBrand(paid);

    const topOrganic = organic.slice(0, 10).map((r, i) => ({
      position:   i + 1,
      title:      r.title      ?? '—',
      source:     r.source     ?? '—',
      price:      r.price      ?? '—',
      thumbnail:  r.thumbnail  ?? null,
      link:       r.link       ?? null,
      isOurs:     (r.source ?? '').toLowerCase().includes(brandLower),
    }));

    const topPaid = paid.slice(0, 10).map((r, i) => ({
      position:  i + 1,
      title:     r.title     ?? '—',
      source:    r.source    ?? '—',
      price:     r.price     ?? '—',
      thumbnail: r.thumbnail ?? null,
      link:      r.link      ?? null,
      isOurs:    (r.source ?? '').toLowerCase().includes(brandLower),
    }));

    return NextResponse.json({
      success: true,
      data: {
        keyword:     q,
        brand,
        country,
        organic: {
          position:  organicPos >= 0 ? organicPos + 1 : null,
          appeared:  organicPos >= 0,
          topResults: topOrganic,
        },
        paid: {
          position:  paidPos >= 0 ? paidPos + 1 : null,
          appeared:  paidPos >= 0,
          topResults: topPaid,
        },
        rateLimit: {
          searchesLeft: accountJson.total_searches_left ?? null,
          planName:     accountJson.plan_name           ?? 'Unknown',
        },
        scannedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
