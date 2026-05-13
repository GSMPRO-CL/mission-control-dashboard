import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  try {
    let dateFilter = '';
    const params: { [key: string]: string | Date } = {};
    let isFiltered = false;

    if (startDateStr && endDateStr) {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      const duration = end.getTime() - start.getTime();
      
      const prevStart = new Date(start.getTime() - duration - 1);
      const prevEnd = new Date(end.getTime() - duration - 1);

      dateFilter = 'WHERE date >= @prevStartDate AND date <= @endDate';
      params.startDate = start;
      params.endDate = end;
      params.prevStartDate = prevStart;
      params.prevEndDate = prevEnd;
      isFiltered = true;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    // Agrupamos por fecha y por métrica
    const query = `
      SELECT 
        DATE(date) as day,
        metric_name, 
        SUM(count) as total_count, 
        SUM(sum_value) as total_value 
      FROM \`${projectId}.${DATASET_ID}.klaviyo_metrics\`
      ${dateFilter}
      GROUP BY day, metric_name
      ORDER BY day ASC
    `;

    const attributionQuery = `
      SELECT 
        campaign_name,
        flow_name,
        metric_name, 
        SUM(count) as total_count, 
        SUM(sum_value) as total_value 
      FROM \`${projectId}.${DATASET_ID}.klaviyo_metrics\`
      ${dateFilter}
      GROUP BY campaign_name, flow_name, metric_name
    `;

    const [rows] = await bq.query({ query: query, params: params });
    const [attrRows] = await bq.query({ query: attributionQuery, params: params });

    // Initial state
    const currentPeriod = { revenue: 0, opens: 0, clicks: 0, received: 0, orders: 0 };
    const prevPeriod = { revenue: 0, opens: 0, clicks: 0, received: 0, orders: 0 };
    const dailyTrendsMap: Record<string, any> = {};

    rows.forEach(row => {
      const rowDate = new Date(row.day.value);
      const isCurrent = !isFiltered || (rowDate >= params.startDate && rowDate <= params.endDate);
      const isPrev = isFiltered && (rowDate >= params.prevStartDate && rowDate <= params.prevEndDate);
      
      const dateStr = row.day.value;
      if (isCurrent) {
        if (!dailyTrendsMap[dateStr]) dailyTrendsMap[dateStr] = { date: dateStr, revenue: 0, clicks: 0, opens: 0 };
      }

      if (row.metric_name === 'Placed Order') {
        if (isCurrent) { currentPeriod.revenue += (row.total_value || 0); currentPeriod.orders += (row.total_count || 0); dailyTrendsMap[dateStr].revenue += (row.total_value || 0); }
        if (isPrev) { prevPeriod.revenue += (row.total_value || 0); prevPeriod.orders += (row.total_count || 0); }
      } else if (row.metric_name === 'Opened Email') {
        if (isCurrent) { currentPeriod.opens += (row.total_count || 0); dailyTrendsMap[dateStr].opens += (row.total_count || 0); }
        if (isPrev) { prevPeriod.opens += (row.total_count || 0); }
      } else if (row.metric_name === 'Clicked Email') {
        if (isCurrent) { currentPeriod.clicks += (row.total_count || 0); dailyTrendsMap[dateStr].clicks += (row.total_count || 0); }
        if (isPrev) { prevPeriod.clicks += (row.total_count || 0); }
      } else if (row.metric_name === 'Received Email') {
        if (isCurrent) { currentPeriod.received += (row.total_count || 0); }
        if (isPrev) { prevPeriod.received += (row.total_count || 0); }
      }
    });

    // Calcular KPIs de Eficiencia (Current)
    const cr = currentPeriod.received > 0 ? (currentPeriod.clicks / currentPeriod.received) * 100 : 0;
    const ctor = currentPeriod.opens > 0 ? (currentPeriod.clicks / currentPeriod.opens) * 100 : 0;
    const orderRate = currentPeriod.clicks > 0 ? (currentPeriod.orders / currentPeriod.clicks) * 100 : 0;
    const aov = currentPeriod.orders > 0 ? currentPeriod.revenue / currentPeriod.orders : 0;

    // Calcular KPIs de Eficiencia (Prev)
    const prevCr = prevPeriod.received > 0 ? (prevPeriod.clicks / prevPeriod.received) * 100 : 0;
    const prevCtor = prevPeriod.opens > 0 ? (prevPeriod.clicks / prevPeriod.opens) * 100 : 0;
    const prevOrderRate = prevPeriod.clicks > 0 ? (prevPeriod.orders / prevPeriod.clicks) * 100 : 0;
    const prevAov = prevPeriod.orders > 0 ? prevPeriod.revenue / prevPeriod.orders : 0;

    const calcDelta = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };

    const flowsMap: Record<string, any> = {};
    const campaignsMap: Record<string, any> = {};

    attrRows.forEach((row: any) => {
      const isFlow = row.flow_name && row.flow_name.trim() !== '';
      const isCampaign = row.campaign_name && row.campaign_name.trim() !== '';

      const targetDict = isFlow ? flowsMap : (isCampaign ? campaignsMap : null);
      const key = isFlow ? row.flow_name : (isCampaign ? row.campaign_name : null);

      if (targetDict && key) {
        if (!targetDict[key]) targetDict[key] = { name: key, revenue: 0, orders: 0, opens: 0, clicks: 0, received: 0 };
        if (row.metric_name === 'Placed Order') {
          targetDict[key].revenue += (row.total_value || 0);
          targetDict[key].orders += (row.total_count || 0);
        } else if (row.metric_name === 'Opened Email') {
          targetDict[key].opens += (row.total_count || 0);
        } else if (row.metric_name === 'Clicked Email') {
          targetDict[key].clicks += (row.total_count || 0);
        } else if (row.metric_name === 'Received Email') {
          targetDict[key].received += (row.total_count || 0);
        }
      }
    });

    const computeAttrKPIs = (item: any) => {
      const cr = item.received > 0 ? (item.clicks / item.received) * 100 : 0;
      const ctor = item.opens > 0 ? (item.clicks / item.opens) * 100 : 0;
      const orderRate = item.clicks > 0 ? (item.orders / item.clicks) * 100 : 0;
      const aov = item.orders > 0 ? item.revenue / item.orders : 0;
      return { ...item, cr, ctor, orderRate, aov };
    };

    const flows = Object.values(flowsMap).map(computeAttrKPIs).sort((a, b) => b.revenue - a.revenue);
    const campaigns = Object.values(campaignsMap).map(computeAttrKPIs).sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      current: {
        revenue: currentPeriod.revenue,
        cr: cr,
        ctor: ctor,
        orderRate: orderRate,
        aov: aov,
        orders: currentPeriod.orders,
        clicks: currentPeriod.clicks,
        opens: currentPeriod.opens,
        received: currentPeriod.received
      },
      deltas: {
        revenue: calcDelta(currentPeriod.revenue, prevPeriod.revenue),
        cr: cr - prevCr, // Absolute diff for percentages
        ctor: ctor - prevCtor, // Absolute diff for percentages
        orderRate: orderRate - prevOrderRate, // Absolute diff for percentages
        aov: calcDelta(aov, prevAov)
      },
      dailyTrends: Object.values(dailyTrendsMap).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      flows: flows,
      campaigns: campaigns
    });
  } catch (error: any) {
    console.error("API Klaviyo Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
