import { NextResponse } from 'next/server';
import { BigQuery } from '@google-cloud/bigquery';

const bigquery = new BigQuery();

export async function GET() {
  try {
    const query = `
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.total_price,
        o.currency,
        o.estado_de_pedido,
        ARRAY_AGG(STRUCT(
          l.id as line_id,
          l.title,
          l.quantity,
          l.price,
          l.vendor
        )) as lines
      FROM \`ecommerce_data.shopify_orders\` o
      LEFT JOIN \`ecommerce_data.shopify_order_lines\` l ON o.id = l.order_id
      WHERE 
        o.financial_status = 'paid' AND
        IFNULL(o.fulfillment_status, '') != 'fulfilled' AND
        (
          o.estado_de_pedido LIKE '0. %' OR
          o.estado_de_pedido LIKE '1. %' OR
          o.estado_de_pedido LIKE '2. %' OR
          o.estado_de_pedido LIKE '3. %' OR
          o.estado_de_pedido LIKE '4. %' OR
          o.estado_de_pedido LIKE '5. %'
        )
      GROUP BY 
        o.id, o.order_number, o.created_at, o.total_price, o.currency, o.estado_de_pedido
      ORDER BY o.created_at DESC
    `;

    const [rows] = await bigquery.query({ query });

    // Handle BigQuery TIMESTAMP/DATETIME object ({ value: '...' })
    const processedRows = rows.map((row: any) => {
      let createdAtStr = row.created_at?.value || row.created_at;
      if (typeof createdAtStr === 'string' && !createdAtStr.endsWith('Z')) {
        createdAtStr += 'Z';
      } else if (createdAtStr && typeof createdAtStr.toISOString === 'function') {
        createdAtStr = createdAtStr.toISOString();
      }
      return {
        ...row,
        created_at: createdAtStr
      };
    });

    return NextResponse.json({ success: true, data: processedRows });
  } catch (error: any) {
    console.error('Error fetching pedidos por comprar:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pedidos por comprar' },
      { status: 500 }
    );
  }
}
