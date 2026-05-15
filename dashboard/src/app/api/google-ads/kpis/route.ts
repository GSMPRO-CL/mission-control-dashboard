import { NextResponse } from 'next/server';
import { getGoogleAdsCustomer } from '@/lib/google-ads-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Default to current year (YTD)
    const now = new Date();
    const firstDayOfYear = new Date(now.getFullYear(), 0, 1);

    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam)))
      ? new Date(startDateParam)
      : firstDayOfYear;
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
        metrics.cost_micros
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
        metrics.cost_micros
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
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
      ORDER BY metrics.cost_micros DESC
    `;

    // ── Query 4: Conversion Breakdown ──
    const conversionBreakdownQuery = `
      SELECT
        campaign.id,
        segments.date,
        segments.conversion_action_name,
        segments.conversion_action_category,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
        AND campaign.status != 'REMOVED'
        AND metrics.conversions > 0
    `;

    const [kpiResults, trendResults, campaignResults, conversionResults] = await Promise.all([
      customer.query(kpiQuery),
      customer.query(trendQuery),
      customer.query(campaignQuery),
      customer.query(conversionBreakdownQuery),
    ]);

    // ── Process KPI aggregates ──
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCostMicros = BigInt(0);

    for (const row of kpiResults) {
      totalImpressions += Number(row.metrics?.impressions ?? 0);
      totalClicks += Number(row.metrics?.clicks ?? 0);
      totalCostMicros += BigInt(row.metrics?.cost_micros ?? 0);
    }

    const totalCost = Number(totalCostMicros) / 1_000_000;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0;
    const avgCpc = totalClicks > 0 ? (totalCost / totalClicks) : 0;

    // ── Process daily trend ──
    const dailyMap = new Map<string, { impressions: number; clicks: number; cost: number; conversions: number }>();
    
    for (const row of trendResults) {
      const date = row.segments?.date ?? '';
      const existing = dailyMap.get(date) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      existing.impressions += Number(row.metrics?.impressions ?? 0);
      existing.clicks += Number(row.metrics?.clicks ?? 0);
      existing.cost += Number(row.metrics?.cost_micros ?? 0) / 1_000_000;
      dailyMap.set(date, existing);
    }

    // ── Process conversions breakdown ──
    const globalPurchasesBreakdown: Record<string, { conversions: number; value: number }> = {};
    const globalMicroBreakdown: Record<string, { conversions: number; value: number }> = {};
    const campaignPurchasesBreakdown: Record<string, Record<string, { conversions: number; value: number }>> = {};
    const campaignMicroBreakdown: Record<string, Record<string, { conversions: number; value: number }>> = {};

    let totalPurchases = 0;
    let totalPurchasesValue = 0;
    let totalMicroConversions = 0;

    for (const row of conversionResults) {
      const id = String(row.campaign?.id ?? '');
      const date = row.segments?.date ?? '';
      const actionName = row.segments?.conversion_action_name ?? 'Unknown';
      const category = row.segments?.conversion_action_category;
      const conversions = Number(row.metrics?.conversions ?? 0);
      const value = Number(row.metrics?.conversions_value ?? 0);

      const isPurchase = category === 4 || category === 'PURCHASE';

      if (isPurchase) {
        totalPurchases += conversions;
        totalPurchasesValue += value;
        
        // Add to daily trend (only purchases)
        if (date) {
          const existing = dailyMap.get(date) || { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
          existing.conversions += conversions;
          dailyMap.set(date, existing);
        }

        // Global breakdown
        if (!globalPurchasesBreakdown[actionName]) globalPurchasesBreakdown[actionName] = { conversions: 0, value: 0 };
        globalPurchasesBreakdown[actionName].conversions += conversions;
        globalPurchasesBreakdown[actionName].value += value;

        // Campaign breakdown
        if (!campaignPurchasesBreakdown[id]) campaignPurchasesBreakdown[id] = {};
        if (!campaignPurchasesBreakdown[id][actionName]) campaignPurchasesBreakdown[id][actionName] = { conversions: 0, value: 0 };
        campaignPurchasesBreakdown[id][actionName].conversions += conversions;
        campaignPurchasesBreakdown[id][actionName].value += value;
      } else {
        totalMicroConversions += conversions;
        // Global breakdown
        if (!globalMicroBreakdown[actionName]) globalMicroBreakdown[actionName] = { conversions: 0, value: 0 };
        globalMicroBreakdown[actionName].conversions += conversions;
        globalMicroBreakdown[actionName].value += value;

        // Campaign breakdown
        if (!campaignMicroBreakdown[id]) campaignMicroBreakdown[id] = {};
        if (!campaignMicroBreakdown[id][actionName]) campaignMicroBreakdown[id][actionName] = { conversions: 0, value: 0 };
        campaignMicroBreakdown[id][actionName].conversions += conversions;
        campaignMicroBreakdown[id][actionName].value += value;
      }
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

    const costPerPurchase = totalPurchases > 0 ? (totalCost / totalPurchases) : 0;
    const costPerMicroConversion = totalMicroConversions > 0 ? (totalCost / totalMicroConversions) : 0;
    const roas = totalCost > 0 ? (totalPurchasesValue / totalCost) : 0;

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
        });
      } else {
        existing.impressions += Number(row.metrics?.impressions ?? 0);
        existing.clicks += Number(row.metrics?.clicks ?? 0);
        existing.costMicros += BigInt(row.metrics?.cost_micros ?? 0);
      }
    }

    const campaigns = Array.from(campaignMap.values()).map((c) => {
      const cost = Number(c.costMicros) / 1_000_000;
      
      const purchasesObj = campaignPurchasesBreakdown[c.id] || {};
      let campaignPurchases = 0;
      let campaignPurchasesValue = 0;
      for (const key in purchasesObj) {
        campaignPurchases += purchasesObj[key].conversions;
        campaignPurchasesValue += purchasesObj[key].value;
      }

      const microObj = campaignMicroBreakdown[c.id] || {};
      let campaignMicro = 0;
      for (const key in microObj) {
        campaignMicro += microObj[key].conversions;
      }

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
        conversions: campaignPurchases,
        costPerPurchase: campaignPurchases > 0 ? (cost / campaignPurchases) : 0,
        costPerMicroConversion: campaignMicro > 0 ? (cost / campaignMicro) : 0,
        roas: cost > 0 ? (campaignPurchasesValue / cost) : 0,
        purchasesBreakdown: purchasesObj,
        microBreakdown: microObj,
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
          conversions: totalPurchases,
          costPerPurchase: Math.round(costPerPurchase * 100) / 100,
          costPerMicroConversion: Math.round(costPerMicroConversion * 100) / 100,
          conversionsValue: Math.round(totalPurchasesValue * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          purchasesBreakdown: globalPurchasesBreakdown,
          microBreakdown: globalMicroBreakdown,
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
