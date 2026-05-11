import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'SERPAPI_KEY no configurada' }, { status: 500 });
  }

  try {
    const url = new URL('https://serpapi.com/account.json');
    url.searchParams.set('api_key', apiKey);

    const res  = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();

    return NextResponse.json({
      success: true,
      data: {
        searchesLeft: json.total_searches_left   ?? null,
        monthlyUsage: json.this_month_usage      ?? null,
        monthlyLimit: json.searches_per_month    ?? null,
        planName:     json.plan_name             ?? 'Unknown',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
