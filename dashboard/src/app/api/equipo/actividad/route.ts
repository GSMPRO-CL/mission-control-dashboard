import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

export async function GET() {
  try {
    const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const dataset = 'raw_layer';

    // 1. Agregación de actividad para gráficos
    const querySummary = `
      SELECT 
        a.staff_id, 
        CONCAT(IFNULL(s.first_name, ''), ' ', IFNULL(s.last_name, '')) as full_name,
        a.action,
        COUNT(*) as event_count,
        MAX(a.occurred_at) as last_activity
      FROM \`${process.env.GCP_PROJECT_ID}.${dataset}.shopify_audit_log\` a
      JOIN \`${process.env.GCP_PROJECT_ID}.${dataset}.shopify_staff\` s 
        ON a.staff_id = s.staff_id
      WHERE a.staff_id IS NOT NULL
      GROUP BY a.staff_id, full_name, a.action
      ORDER BY event_count DESC
    `;
    const [summaryRows] = await bq.query({ query: querySummary });

    // 2. Últimos eventos procesados para la tabla
    const queryEvents = `
      SELECT 
        a.audit_id,
        a.occurred_at,
        CONCAT(IFNULL(s.first_name, ''), ' ', IFNULL(s.last_name, '')) as full_name,
        a.action,
        a.subject_type,
        a.subject_id
      FROM \`${process.env.GCP_PROJECT_ID}.${dataset}.shopify_audit_log\` a
      JOIN \`${process.env.GCP_PROJECT_ID}.${dataset}.shopify_staff\` s 
        ON a.staff_id = s.staff_id
      WHERE a.staff_id IS NOT NULL
      ORDER BY a.occurred_at DESC
      LIMIT 100
    `;
    const [eventRows] = await bq.query({ query: queryEvents });

    return NextResponse.json({ summary: summaryRows, recentEvents: eventRows });
  } catch (err: any) {
    console.error("Error fetching team activity:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
