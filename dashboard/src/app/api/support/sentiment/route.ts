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
      dateFilter = 'AND created_at >= @startDate AND created_at <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    
    const query = `
      SELECT 
        EXTRACT(DATE FROM created_at) as date,
        AVG(sentiment_score) as avg_score,
        COUNTIF(sentiment_score < -0.2) as negative_tickets,
        COUNTIF(sentiment_score >= -0.2 AND sentiment_score <= 0.2) as neutral_tickets,
        COUNTIF(sentiment_score > 0.2) as positive_tickets
      FROM \`${projectId}.${DATASET_ID}.crisp_messages\`
      WHERE sender_type = 'user' AND sentiment_score IS NOT NULL
      ${dateFilter}
      GROUP BY date
      ORDER BY date
    `;

    const options = {
      query: query,
      params: params,
    };

    const [rows] = await bq.query(options);

    // Transform date to ISO string for frontend
    const formattedRows = rows.map((r: any) => ({
      ...r,
      date: r.date ? r.date.value : null
    }));

    return NextResponse.json({ success: true, data: formattedRows });
  } catch (error: any) {
    console.error("API Support Sentiment Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
