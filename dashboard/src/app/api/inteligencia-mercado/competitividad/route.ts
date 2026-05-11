import { NextRequest, NextResponse } from 'next/server';

const SERPAPI = 'https://serpapi.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q         = (searchParams.get('q') || '').trim();
  const ourPrice  = parseFloat(searchParams.get('our_price') || '0');
  const country   = searchParams.get('country') || 'us';

  if (!q) {
    return NextResponse.json({ success: false, error: 'Query requerida (?q=producto)' }, { status: 400 });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'SERPAPI_KEY no configurada' }, { status: 500 });
  }

  try {
    const shoppingUrl = new URL(`${SERPAPI}/search.json`);
    shoppingUrl.searchParams.set('engine',  'google_shopping');
    shoppingUrl.searchParams.set('q',       q);
    shoppingUrl.searchParams.set('gl',      country);
    shoppingUrl.searchParams.set('hl',      'es');
    shoppingUrl.searchParams.set('api_key', apiKey);

    const accountUrl = new URL(`${SERPAPI}/account.json`);
    accountUrl.searchParams.set('api_key', apiKey);

    const [shoppingRes, accountRes] = await Promise.all([
      fetch(shoppingUrl.toString(), { cache: 'no-store' }),
      fetch(accountUrl.toString(),  { cache: 'no-store' }),
    ]);

    const [shoppingJson, accountJson] = await Promise.all([
      shoppingRes.json(),
      accountRes.json(),
    ]);

    if (shoppingJson.error) {
      return NextResponse.json({ success: false, error: shoppingJson.error }, { status: 400 });
    }

    const raw: any[] = shoppingJson.shopping_results ?? [];

    const competitors = raw.slice(0, 20).map((item: any) => {
      const competitorPrice: number = item.extracted_price ?? 0;
      const diffAmount = ourPrice > 0 ? competitorPrice - ourPrice : null;
      const diffPct    = ourPrice > 0 && competitorPrice > 0
        ? Math.round(((competitorPrice - ourPrice) / ourPrice) * 1000) / 10
        : null;

      return {
        title:           item.title          ?? '—',
        source:          item.source         ?? '—',
        price:           item.price          ?? '—',
        extractedPrice:  competitorPrice,
        thumbnail:       item.thumbnail      ?? null,
        link:            item.link           ?? null,
        rating:          item.rating         ?? null,
        reviews:         item.reviews        ?? null,
        delivery:        item.delivery       ?? null,
        condition:       item.second_hand_condition ?? 'Nuevo',
        diffAmount,
        diffPct,
        isCompetitive:   ourPrice > 0 && competitorPrice > 0 ? ourPrice <= competitorPrice : null,
      };
    });

    const pricesWithOurs = competitors
      .filter(c => c.extractedPrice > 0 && ourPrice > 0)
      .map(c => c.extractedPrice);

    const lowestCompetitor  = pricesWithOurs.length > 0 ? Math.min(...pricesWithOurs) : null;
    const highestCompetitor = pricesWithOurs.length > 0 ? Math.max(...pricesWithOurs) : null;
    const avgCompetitor     = pricesWithOurs.length > 0
      ? Math.round(pricesWithOurs.reduce((s, p) => s + p, 0) / pricesWithOurs.length * 100) / 100
      : null;

    const competitiveCount = competitors.filter(c => c.isCompetitive === true).length;
    const competitivenessRate = competitors.filter(c => c.isCompetitive !== null).length > 0
      ? Math.round((competitiveCount / competitors.filter(c => c.isCompetitive !== null).length) * 100)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        query: q,
        ourPrice: ourPrice > 0 ? ourPrice : null,
        competitors,
        summary: {
          total:              competitors.length,
          lowestCompetitor,
          highestCompetitor,
          avgCompetitor,
          competitivenessRate,
        },
        rateLimit: {
          searchesLeft: accountJson.total_searches_left ?? null,
          planName:     accountJson.plan_name           ?? 'Unknown',
        },
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
