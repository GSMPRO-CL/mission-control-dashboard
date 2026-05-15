import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Default to MTD if no dates provided
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const startDate = (startDateParam && !isNaN(Date.parse(startDateParam))) ? new Date(startDateParam) : firstDayOfMonth;
    const endDate = (endDateParam && !isNaN(Date.parse(endDateParam))) ? new Date(endDateParam) : now;

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const projectId = process.env.GCP_PROJECT_ID;

    // 1. Ventas KPIs & Trend
    const queryVentas = `
      SELECT
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) as net_sales,
        COUNT(id) as total_orders,
        MAX(currency) as currency
      FROM \`${projectId}.${DATASET_ID}.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
    `;

    const queryVentasTrend = `
      SELECT
        CAST(DATE(created_at) AS STRING) as date,
        SUM(CASE WHEN financial_status IN ('paid', 'partially_refunded') THEN total_price ELSE 0 END) as net_sales
      FROM \`${projectId}.${DATASET_ID}.shopify_orders\`
      WHERE created_at >= @startDate AND created_at <= @endDate
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Tráfico KPIs & Trend
    const queryTrafico = `
      SELECT
        CAST(t.date AS STRING) as date,
        t.total_sessions,
        t.unique_visitors,
        COUNT(o.id) as orders
      FROM \`${projectId}.${DATASET_ID}.shopify_traffic_daily\` t
      LEFT JOIN \`${projectId}.${DATASET_ID}.shopify_orders\` o
        ON DATE(o.created_at) = t.date 
        AND o.financial_status IN ('paid', 'partially_refunded')
      WHERE t.date >= @startDateStr AND t.date <= @endDateStr
      GROUP BY t.date, t.total_sessions, t.unique_visitors
      ORDER BY t.date ASC
    `;

    // 3. Marketing (Klaviyo)
    const queryMarketing = `
      SELECT 
        SUM(count) as total_orders, 
        SUM(sum_value) as total_revenue 
      FROM \`${projectId}.${DATASET_ID}.klaviyo_metrics\`
      WHERE date >= @startDate AND date <= @endDate
      AND metric_name = 'Placed Order'
    `;

    // 4. Soporte (Crisp)
    const querySoporte = `
      SELECT 
        COUNT(session_id) as total_conversations, 
        COUNTIF(status = 'resolved') as resolved_conversations, 
        AVG(rating_value) as avg_csat 
      FROM \`${projectId}.${DATASET_ID}.crisp_conversations\`
      WHERE created_at >= @startDate AND created_at <= @endDate
    `;

    // 5. Reseñas (Yotpo) (Global, as it's not historically filtered by created_at in the raw table structure generally, or we can just fetch all published)
    const queryYotpo = `
      SELECT 
        COUNT(review_id) as total_reviews,
        COUNTIF(status = 'published') as published_reviews,
        AVG(IF(status = 'published', score, NULL)) as average_rating,
        COUNTIF(status = 'published' AND score >= 4) as positive_reviews
      FROM \`${projectId}.${DATASET_ID}.raw_yotpo_reviews\`
    `;

    // 6. Equipo (Audit Log Top 5)
    const queryEquipo = `
      SELECT 
        staff_full_name as name,
        COUNT(*) as events
      FROM \`${projectId}.raw_layer.v_audit_log_enriched\`
      WHERE occurred_at >= @startDate AND occurred_at <= @endDate AND staff_id IS NOT NULL
      GROUP BY staff_full_name
      ORDER BY events DESC
      LIMIT 5
    `;

    const params = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateStr: startDateStr,
      endDateStr: endDateStr
    };

    const [
      [rowsVentas],
      [rowsVentasTrend],
      [rowsTrafico],
      [rowsMarketing],
      [rowsSoporte],
      [rowsYotpo],
      [rowsEquipo]
    ] = await Promise.all([
      bq.query({ query: queryVentas, params }),
      bq.query({ query: queryVentasTrend, params }),
      bq.query({ query: queryTrafico, params }),
      bq.query({ query: queryMarketing, params }),
      bq.query({ query: querySoporte, params }),
      bq.query({ query: queryYotpo, params }), // no params for yotpo as it fetches overall health
      bq.query({ query: queryEquipo, params })
    ]);

    // Format Ventas
    const ventas = {
      netSales: parseFloat(rowsVentas[0]?.net_sales) || 0,
      totalOrders: parseInt(rowsVentas[0]?.total_orders, 10) || 0,
      currency: rowsVentas[0]?.currency || 'USD',
      trend: rowsVentasTrend.map(r => ({ date: r.date, netSales: parseFloat(r.net_sales) || 0 }))
    };

    // Format Trafico
    let sumSessions = 0;
    let sumVisitors = 0;
    let sumOrdersTrafico = 0;
    const traficoTrend = rowsTrafico.map(r => {
      const sessions = parseInt(r.total_sessions, 10) || 0;
      const visitors = parseInt(r.unique_visitors, 10) || 0;
      const orders = parseInt(r.orders, 10) || 0;
      sumSessions += sessions;
      sumVisitors += visitors;
      sumOrdersTrafico += orders;
      return { date: r.date, sessions, visitors };
    });
    
    const trafico = {
      totalSessions: sumSessions,
      avgConversionRate: sumSessions > 0 ? (sumOrdersTrafico / sumSessions) * 100 : 0,
      trend: traficoTrend
    };

    // Format Marketing
    const marketing = {
      emailRevenue: parseFloat(rowsMarketing[0]?.total_revenue) || 0,
      emailOrders: parseInt(rowsMarketing[0]?.total_orders, 10) || 0
    };

    // Format Soporte
    const s = rowsSoporte[0] || {};
    const totalConv = parseInt(s.total_conversations, 10) || 0;
    const resConv = parseInt(s.resolved_conversations, 10) || 0;
    const soporte = {
      totalConversations: totalConv,
      resolvedConversations: resConv,
      avgCsat: s.avg_csat ? Math.round(s.avg_csat * 10) / 10 : 0,
      resolutionRate: totalConv > 0 ? (resConv / totalConv) * 100 : 0
    };

    // Format Yotpo
    const y = rowsYotpo[0] || {};
    const pubReviews = parseInt(y.published_reviews, 10) || 0;
    const posReviews = parseInt(y.positive_reviews, 10) || 0;
    const reviews = {
      averageRating: y.average_rating ? Number(y.average_rating).toFixed(1) : "0.0",
      totalReviews: parseInt(y.total_reviews, 10) || 0,
      sentimentScore: pubReviews > 0 ? Math.round((posReviews / pubReviews) * 100) : 0
    };

    // Format Equipo
    const equipo = {
      topStaff: rowsEquipo.map(r => ({
        name: r.name || 'Unknown',
        events: parseInt(r.events, 10) || 0
      }))
    };

    return NextResponse.json({
      success: true,
      data: {
        ventas,
        trafico,
        marketing,
        soporte,
        reviews,
        equipo
      }
    });
  } catch (error: any) {
    console.error('API Overview Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
