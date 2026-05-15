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
        EXTRACT(HOUR FROM created_at) as hourOfDay, 
        COUNT(session_id) as total_tickets
      FROM \`${projectId}.${DATASET_ID}.crisp_conversations\`
      ${dateFilter}
      GROUP BY hourOfDay
      ORDER BY hourOfDay ASC
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);

    const allHours = Array.from({ length: 24 }, (_, i) => ({
      hourOfDay: i,
      total_tickets: 0
    }));

    rows.forEach(row => {
      const h = row.hourOfDay;
      if (h >= 0 && h < 24) {
        allHours[h].total_tickets = row.total_tickets;
      }
    });

    return NextResponse.json({ success: true, data: allHours });
  } catch (error: any) {
    console.error("Peak Hours API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
