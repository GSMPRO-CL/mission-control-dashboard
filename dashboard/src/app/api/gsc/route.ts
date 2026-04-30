import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const projectId = process.env.GCP_PROJECT_ID;
const bigquery = new BigQuery({ projectId });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT 
        date,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        AVG(ctr) as ctr,
        AVG(position) as position
      FROM \`${projectId}.ecommerce_data.gsc_metrics\`
    `;

    const params: { [key: string]: string } = {};

    if (startDate && endDate) {
      query += ` WHERE date BETWEEN @startDate AND @endDate`;
      params.startDate = startDate;
      params.endDate = endDate;
    }

    query += ` GROUP BY date ORDER BY date ASC`;

    const [rows] = await bigquery.query({
      query: query,
      params: params,
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching GSC data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
