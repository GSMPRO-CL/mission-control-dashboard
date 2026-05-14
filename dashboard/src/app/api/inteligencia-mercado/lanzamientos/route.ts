import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { fetchCloudRun } from '@/lib/cloud-run-client';

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET() {
  try {
    const query = `
      SELECT id, producto, marca, categoria, especificaciones_clave, fuente, estado_db, CAST(fecha_escaneo AS STRING) as fecha_escaneo, CAST(fecha_lanzamiento AS STRING) as fecha_lanzamiento
      FROM \`${process.env.GCP_PROJECT_ID}.raw_layer.market_intelligence_launches\`
      ORDER BY fecha_lanzamiento ASC NULLS LAST, fecha_escaneo DESC
      LIMIT 200
    `;
    const [rows] = await bq.query(query);
    return NextResponse.json({ status: 'success', data: rows });
  } catch (error: any) {
    console.error("Error fetching market intelligence data:", error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Usar cliente centralizado que inyecta tokens IAM si está en Cloud Run
    const res = await fetchCloudRun('/api/v1/releases/scan', {
      method: 'POST',
      cache: 'no-store'
    });
    
    if (!res.ok) {
        throw new Error(`Microservice returned status ${res.status}`);
    }
    
    const json = await res.json();
    return NextResponse.json(json);
  } catch (error: any) {
    console.error("Error triggering python service:", error);
    return NextResponse.json({ error: 'Failed to trigger scan', details: error.message }, { status: 500 });
  }
}
