import { NextResponse } from 'next/server';
import { bq } from '@/lib/bigquery';
import { fetchCloudRun } from '@/lib/cloud-run-client';

export async function GET() {
  try {
    const projectId = process.env.GCP_PROJECT_ID;

    // Fetch upcoming events from BigQuery
    const query = `
      SELECT 
        id, 
        event_name, 
        event_type, 
        event_date, 
        description, 
        source
      FROM \`${projectId}.raw_layer.commercial_calendar\`
      WHERE event_date >= CURRENT_DATE()
      ORDER BY event_date ASC
      LIMIT 100
    `;

    const [rows] = await bq.query(query);

    // Transform date objects to strings for JSON serialization
    const formattedRows = rows.map(row => ({
      ...row,
      event_date: row.event_date ? row.event_date.value : null,
    }));

    return NextResponse.json({
      status: 'success',
      data: formattedRows,
    });
  } catch (error: any) {
    console.error('Error fetching commercial calendar:', error);
    return NextResponse.json(
      { status: 'error', message: 'Error fetching commercial calendar' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Usar cliente centralizado que inyecta tokens IAM si está en Cloud Run
    const response = await fetchCloudRun('/api/v1/calendar/scan', {
      method: 'POST',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Python service responded with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      status: 'success',
      data: data,
    });
  } catch (error: any) {
    console.error('Error triggering commercial calendar scan:', error);
    return NextResponse.json(
      { status: 'error', message: 'Error triggering commercial calendar scan' },
      { status: 500 }
    );
  }
}
