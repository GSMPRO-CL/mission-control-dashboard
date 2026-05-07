import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let dateFilter = '';
    const params: { [key: string]: string } = {};

    if (startDate && endDate) {
      dateFilter = 'AND ticket_created_at >= @startDate AND ticket_created_at <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    const query = `
      SELECT
        operator_name,
        COUNT(session_id) as total_tickets,
        COUNTIF(status = 'resolved') as resolved_tickets,
        AVG(ttfr_minutes) as avg_ttfr,
        AVG(csat_score) as avg_csat
      FROM \`${projectId}.${DATASET_ID}.v_crisp_sla\`
      WHERE operator_name IS NOT NULL
      ${dateFilter}
      GROUP BY operator_name
      ORDER BY total_tickets DESC
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("API Support Agents Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
