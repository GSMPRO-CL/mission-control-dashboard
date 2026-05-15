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
      dateFilter = 'WHERE c.created_at >= @startDate AND c.created_at <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    const query = `
      SELECT 
        SAFE_DIVIDE(COUNT(m.message_id), COUNT(DISTINCT m.session_id)) as avg_messages_per_ticket
      FROM \`${projectId}.${DATASET_ID}.crisp_messages\` m
      JOIN \`${projectId}.${DATASET_ID}.crisp_conversations\` c ON m.session_id = c.session_id
      ${dateFilter}
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);
    const avgMessages = rows[0]?.avg_messages_per_ticket || 0;

    return NextResponse.json({ 
      success: true, 
      avgMessages: Math.round(avgMessages * 10) / 10 
    });
  } catch (error: any) {
    console.error("Resolution Effort API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
