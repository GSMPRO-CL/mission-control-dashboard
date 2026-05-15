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
      dateFilter = 'WHERE created_at >= @startDate AND created_at <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    const query = `
      SELECT 
        FORMAT_DATE('%Y-%m-%d', DATE(created_at)) as date,
        COUNTIF(status = 'resolved') as resolved_count,
        COUNTIF(status != 'resolved') as unresolved_count,
        COUNT(session_id) as total_count
      FROM \`${projectId}.${DATASET_ID}.crisp_conversations\`
      ${dateFilter}
      GROUP BY date
      ORDER BY date ASC
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error("Resolution Rate API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
