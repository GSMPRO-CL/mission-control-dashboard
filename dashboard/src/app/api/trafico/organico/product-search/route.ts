import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Usar BigQuery para búsqueda rápida de productos
    const query = `
      SELECT id, title, handle, vendor
      FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.shopify_products\`
      WHERE LOWER(title) LIKE LOWER(CONCAT('%', @searchTerm, '%'))
         OR LOWER(handle) LIKE LOWER(CONCAT('%', @searchTerm, '%'))
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const [rows] = await bigquery.query({
      query: query,
      params: { searchTerm: q }
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error searching products in BQ:', error);
    return NextResponse.json({ success: false, error: 'Failed to search products' }, { status: 500 });
  }
}
