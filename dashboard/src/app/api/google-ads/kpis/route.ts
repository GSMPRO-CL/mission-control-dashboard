import { NextResponse } from 'next/server';
import { getGoogleAdsCustomer } from '@/lib/google-ads-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Default to current month (MTD)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam)))
      ? new Date(startDateParam)
      : firstDayOfMonth;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam)))
      ? new Date(endDateParam)
      : now;

    // Format dates for GAQL (YYYY-MM-DD)
    const formatGaqlDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const start = formatGaqlDate(startDate);
    const end = formatGaqlDate(endDate);

    const customer = getGoogleAdsCustomer();

    // ── Query 1: Aggregate KPIs across all campaigns ──
    const kpiQuery = `
      SELECT
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.cost_per_conversion,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
    `;

    // ── Query 2: Daily trend ──
    const trendQuery = `
      SELECT
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date ASC
    `;

    // ── Query 3: Campaign breakdown ──
    const campaignQuery = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    const [kpiResults, trendResults, campaignResults] = await Promise.all([
      customer.query(kpiQuery),
      customer.query(trendQuery),
      customer.query(campaignQuery),
    ]);

    // ── Process KPI aggregates ──
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = BigInt(0);
    let totalConversions = 0;
    let totalConversionsValue = 0;

    for (const row of kpiResults) {
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalCostMicros += BigInt(row.metrics?.cost_micros ?? 0);
      totalConversions += Number(row.metrics?.conversions ?? 0);
      totalConversionsValue += Number(row.metrics?.conversions_value ?? 0);
    }

    const totalCost = Number(totalCostMicros) / 1_000_000;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0;
    const avgCpc = totalClicks > 0 ? (totalCost / totalClicks) : 0;
    const costPerConversion = totalConversions > 0 ? (totalCost / totalConversions) : 0;
    const roas = totalCost > 0 ? (totalConversionsValue / totalCost) : 0;

    // ── Process daily trend ──
    const dailyMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
    
    for (const row of trendResults) {
      const date = row.segments?.date ?? '';
      const existing = dailyMap.get(date) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      existing.impressions += Number(row.metrics?.impressions ?? 0);
      existing.clicks += Number(row.metrics?.clicks ?? 0);
      existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
      existing.conversions += Number(row.metrics?.conversions ?? 0);
      dailyMap.set(date, existing);
    }

    const trend = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        impressions: data.impressions,
        clicks: data.clicks,
        cost: Math.round(data.cost * 100) / 100,
        conversions: data.conversions,
      }));

    // ── Process campaign breakdown ──
    const campaignMap = new Map<string, any>();

    for (const row of campaignResults) {
      const id = String(row.campaign?.id ?? '');
      const existing = campaignMap.get(id);
      if (!existing) {
        campaignMap.set(id, {
          id,
          name: row.campaign?.name ?? 'Unknown',
          status: row.campaign?.status ?? 'UNKNOWN',
          channelType: row.campaign?.advertising_channel_type ?? 'UNKNOWN',
          impressions: Number(row.metrics?.impressions ?? 0),
          clicks: Number(row.metrics?.clicks ?? 0),
          costMicros: BigInt(row.metrics?.cost_micros ?? 0),
          conversions: Number(row.metrics?.conversions ?? 0),
          conversionsValue: Number(row.metrics?.conversions_value ?? 0),
        });
      } else {
        existing.impressions += Number(row.metrics?.impressions ?? 0);
        existing.clicks += Number(row.metrics?.clicks ?? 0);
        existing.costMicros += BigInt(row.metrics?.cost_micros ?? 0);
        existing.conversions += Number(row.metrics?.conversions ?? 0);
        existing.conversionsValue += Number(row.metrics?.conversions_value ?? 0);
      }
    }

    const campaigns = Array.from(campaignMap.values()).map((c) => {
      const cost = Number(c.costMicros) / 1_000_000;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        channelType: c.channelType,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) : 0,
        avgCpc: c.clicks > 0 ? (cost / c.clicks) : 0,
        cost,
        conversions: c.conversions,
        roas: cost > 0 ? (c.conversionsValue / cost) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        dateRange: { startDate: start, endDate: end },
        kpis: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
          avgCpc: Math.round(avgCpc * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          conversions: totalConversions,
          costPerConversion: Math.round(costPerConversion * 100) / 100,
          conversionsValue: Math.round(totalConversionsValue * 100) / 100,
          roas: Math.round(roas * 100) / 100,
        },
        trend,
        campaigns,
      },
    });
  } catch (error: any) {
    console.error('Error fetching Google Ads KPIs:', error);

    // Provide clear error messages for common issues
    const message = error.message || 'Failed to fetch Google Ads data';
    const isAuthError = message.includes('credentials missing') || 
                        message.includes('UNAUTHENTICATED') ||
                        message.includes('PERMISSION_DENIED');

    return NextResponse.json(
      { 
        success: false, 
        error: isAuthError 
          ? 'Google Ads authentication failed. Check your credentials in environment variables.'
          : message
      },
      { status: isAuthError ? 401 : 500 }
    );
  }
}
