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
        COUNT(session_id) as total_conversations, 
        COUNTIF(status = 'resolved') as resolved_conversations, 
        AVG(rating_value) as avg_csat 
      FROM \`${projectId}.${DATASET_ID}.crisp_conversations\`
      ${dateFilter}
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);
    const result = rows[0] || {};

    const totalConversations = result.total_conversations || 0;
    const resolvedConversations = result.resolved_conversations || 0;
    // Redondear a 1 decimal
    const avgCsat = result.avg_csat ? Math.round(result.avg_csat * 10) / 10 : 0;

    return NextResponse.json({
      totalConversations,
      resolvedConversations,
      avgCsat
    });
  } catch (error: any) {
    console.error("API Crisp Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
