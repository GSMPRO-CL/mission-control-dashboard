import { NextRequest, NextResponse } from 'next/server';

const SERPAPI = 'https://serpapi.com';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q     = (searchParams.get('q')     || '').trim();
  const date  = searchParams.get('date')   || 'today 12-m';
  const geo   = searchParams.get('geo')    || '';
  const gprop = searchParams.get('gprop')  || '';

  if (!q) {
    return NextResponse.json({ success: false, error: 'Query requerida' }, { status: 400 });
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'SERPAPI_KEY no configurada' }, { status: 500 });
  }

  try {
    const makeUrl = (dataType: string) => {
      const url = new URL(`${SERPAPI}/search.json`);
      url.searchParams.set('engine',    'google_trends');
      url.searchParams.set('q',         q);
      url.searchParams.set('date',      date);
      url.searchParams.set('data_type', dataType);
      if (geo)   url.searchParams.set('geo',   geo);
      if (gprop) url.searchParams.set('gprop', gprop);
      url.searchParams.set('api_key',   apiKey);
      return url.toString();
    };

    const accountUrl = new URL(`${SERPAPI}/account.json`);
    accountUrl.searchParams.set('api_key', apiKey);

    const [trendsRes, geoRes, accountRes] = await Promise.all([
      fetch(makeUrl('TIMESERIES'), { cache: 'no-store' }),
      fetch(makeUrl('GEO_MAP'),    { cache: 'no-store' }),
      fetch(accountUrl.toString(), { cache: 'no-store' }),
    ]);

    const [trendsJson, geoJson, accountJson] = await Promise.all([
      trendsRes.json(),
      geoRes.json().catch(() => ({})),
      accountRes.json(),
    ]);

    if (trendsJson.error) {
      return NextResponse.json({ success: false, error: trendsJson.error }, { status: 400 });
    }

    const queries   = q.split(',').map((s: string) => s.trim()).filter(Boolean);
    const topRegion = (geoJson.interest_by_region?.[0]?.location as string) ?? '—';

    return NextResponse.json({
      success: true,
      data: {
        timeline:  trendsJson.interest_over_time?.timeline_data ?? [],
        averages:  trendsJson.interest_over_time?.averages      ?? [],
        queries,
        topRegion,
        fetchedAt: new Date().toISOString(),
        rateLimit: {
          searchesLeft: accountJson.total_searches_left ?? null,
          monthlyUsage: accountJson.this_month_usage    ?? null,
          monthlyLimit: accountJson.searches_per_month  ?? null,
          planName:     accountJson.plan_name           ?? 'Unknown',
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
