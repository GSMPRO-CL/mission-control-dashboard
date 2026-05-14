import { NextResponse } from 'next/server';
import { bq } from '@/lib/bigquery';

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

    // Staff IDs filter
    const staffIdsParam = searchParams.get('staffIds');
    const staffIds = staffIdsParam ? staffIdsParam.split(',') : [];

    // Actions filter
    const actionsParam = searchParams.get('actions');
    const actions = actionsParam ? actionsParam.split(',') : [];

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10));
    const offset = (page - 1) * limit;

    const projectId = process.env.GCP_PROJECT_ID;
    const viewName = `\`${projectId}.raw_layer.v_audit_log_enriched\``;

    // Base WHERE clause
    let whereClause = `occurred_at >= @startDate AND occurred_at <= @endDate AND staff_id IS NOT NULL`;
    if (staffIds.length > 0) {
      whereClause += ` AND staff_id IN UNNEST(@staffIds)`;
    }
    if (actions.length > 0) {
      whereClause += ` AND action IN UNNEST(@actions)`;
    }

    const queryParams: Record<string, any> = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: limit,
      offset: offset
    };

    if (staffIds.length > 0) queryParams.staffIds = staffIds;
    if (actions.length > 0) queryParams.actions = actions;

    // 1. Summary Query
    const querySummary = `
      SELECT 
        staff_id, 
        staff_full_name as full_name,
        action,
        COUNT(*) as event_count,
        MAX(occurred_at) as last_activity
      FROM ${viewName}
      WHERE ${whereClause}
      GROUP BY staff_id, staff_full_name, action
      ORDER BY event_count DESC
    `;

    // 2. Time Series Query
    const queryTimeSeries = `
      SELECT 
        CAST(DATE(occurred_at) AS STRING) as date,
        staff_id,
        staff_full_name as full_name,
        COUNT(*) as events
      FROM ${viewName}
      WHERE ${whereClause}
      GROUP BY date, staff_id, staff_full_name
      ORDER BY date ASC
    `;

    // 3. Events Query (Paginated)
    const queryEvents = `
      SELECT 
        audit_id,
        occurred_at,
        staff_id,
        staff_full_name as full_name,
        action,
        subject_type,
        subject_id
      FROM ${viewName}
      WHERE ${whereClause}
      ORDER BY occurred_at DESC
      LIMIT @limit OFFSET @offset
    `;

    // 4. Meta Query (Count)
    const queryMetaCount = `
      SELECT COUNT(*) as total_events
      FROM ${viewName}
      WHERE ${whereClause}
    `;

    // 5. Staff List Query (For filter dropdown)
    const queryStaff = `
      SELECT 
        staff_id,
        CONCAT(IFNULL(first_name, ''), ' ', IFNULL(last_name, '')) as full_name
      FROM \`${projectId}.raw_layer.shopify_staff\`
      WHERE staff_id IS NOT NULL
      ORDER BY full_name ASC
    `;

    // 6. Action List Query (For filter dropdown)
    const queryActions = `
      SELECT DISTINCT action
      FROM ${viewName}
      WHERE action IS NOT NULL
      ORDER BY action ASC
    `;

    // Execute queries in parallel
    const [
      [summaryRows],
      [timeSeriesRows],
      [eventRows],
      [metaRows],
      [staffRows],
      [actionRows]
    ] = await Promise.all([
      bq.query({ query: querySummary, params: queryParams }),
      bq.query({ query: queryTimeSeries, params: queryParams }),
      bq.query({ query: queryEvents, params: queryParams }),
      bq.query({ query: queryMetaCount, params: queryParams }),
      bq.query({ query: queryStaff }),
      bq.query({ query: queryActions })
    ]);

    const totalEvents = metaRows[0]?.total_events ? parseInt(metaRows[0].total_events, 10) : 0;
    const totalPages = Math.ceil(totalEvents / limit);

    return NextResponse.json({
      summary: summaryRows,
      timeSeries: timeSeriesRows,
      recentEvents: eventRows,
      meta: {
        totalEvents,
        totalPages,
        currentPage: page,
        dateRange: { startDate, endDate },
        staffList: staffRows,
        actionList: actionRows.map(r => r.action)
      }
    });
  } catch (err: any) {
    console.error("Error fetching team activity:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
