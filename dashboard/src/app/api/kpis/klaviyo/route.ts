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
      dateFilter = 'WHERE date >= @startDate AND date <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    const query = `
      SELECT 
        metric_name, 
        SUM(count) as total_count, 
        SUM(sum_value) as total_value 
      FROM \`${projectId}.${DATASET_ID}.klaviyo_metrics\`
      ${dateFilter}
      GROUP BY metric_name
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);

    let attributedRevenue = 0;
    let openedCount = 0;
    let clickedCount = 0;

    rows.forEach(row => {
      if (row.metric_name === 'Placed Order') {
        attributedRevenue = row.total_value || 0;
      } else if (row.metric_name === 'Opened Email') {
        openedCount = row.total_count || 0;
      } else if (row.metric_name === 'Clicked Email') {
        clickedCount = row.total_count || 0;
      }
    });

    return NextResponse.json({
      attributedRevenue,
      openedCount,
      clickedCount
    });
  } catch (error: any) {
    console.error("API Klaviyo Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
