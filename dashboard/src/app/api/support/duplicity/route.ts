import { NextResponse } from 'next/server';
import { bq, DATASET_ID } from '@/lib/bigquery';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let dateFilterTable = '';
    let dateFilterView = '';
    const params: { [key: string]: string } = {};

    if (startDate && endDate) {
      dateFilterTable = 'AND created_at >= @startDate AND created_at <= @endDate';
      dateFilterView = 'WHERE first_contact >= @startDate AND last_contact <= @endDate';
      params.startDate = startDate;
      params.endDate = endDate;
    }

    const projectId = process.env.GCP_PROJECT_ID;
    const crispWebsiteId = process.env.CRISP_WEBSITE_ID;
    
    const kpiQuery = `
      SELECT
        (SELECT COUNT(DISTINCT people_id) 
         FROM \`${projectId}.${DATASET_ID}.crisp_conversations\` 
         WHERE people_id IS NOT NULL ${dateFilterTable}
        ) AS total_identified_users,
        COUNT(*) AS duplicated_users,
        SAFE_DIVIDE(COUNT(*), 
          (SELECT COUNT(DISTINCT people_id) 
           FROM \`${projectId}.${DATASET_ID}.crisp_conversations\` 
           WHERE people_id IS NOT NULL ${dateFilterTable})
        ) * 100 AS duplicity_rate_pct
      FROM \`${projectId}.${DATASET_ID}.v_crisp_omnichannel_duplicity\`
      ${dateFilterView}
    `;

    const detailQuery = `
      SELECT
        people_id,
        visitor_nickname,
        visitor_email,
        channels_used,
        distinct_channels,
        first_contact,
        last_contact,
        latest_session_id
      FROM \`${projectId}.${DATASET_ID}.v_crisp_omnichannel_duplicity\`
      ${dateFilterView}
      ORDER BY distinct_channels DESC, last_contact DESC
      LIMIT 50
    `;

    const [[kpiRows], [detailRows]] = await Promise.all([
      bq.query({ query: kpiQuery, params }),
      bq.query({ query: detailQuery, params })
    ]);

    const kpi = kpiRows[0] || {
      total_identified_users: 0,
      duplicated_users: 0,
      duplicity_rate_pct: 0
    };

    return NextResponse.json({ 
      success: true, 
      data: {
        kpi,
        details: detailRows,
        crispWebsiteId
      } 
    });
  } catch (error: any) {
    console.error("Omnichannel Duplicity API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
