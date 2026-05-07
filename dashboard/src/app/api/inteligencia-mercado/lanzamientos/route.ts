import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';
import { GoogleAuth } from 'google-auth-library';

const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET() {
  try {
    const query = `
      SELECT id, producto, marca, categoria, especificaciones_clave, fuente, estado_db, fecha_escaneo
      FROM \`${process.env.GCP_PROJECT_ID}.raw_layer.market_intelligence_launches\`
      ORDER BY fecha_escaneo DESC
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
    // Llama al microservicio en producción o localmente
    const serviceUrl = process.env.PRODUCT_INTELLIGENCE_URL || 'http://localhost:8000';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Si es Cloud Run (producción), inyectamos el Token IAM
    if (serviceUrl.includes('run.app')) {
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(serviceUrl);
      const authHeaders = await client.getRequestHeaders();
      headers['Authorization'] = (authHeaders as any).Authorization || (authHeaders as any).authorization;
    }

    const res = await fetch(`${serviceUrl}/api/v1/releases/scan`, {
      method: 'POST',
      headers: headers,
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
