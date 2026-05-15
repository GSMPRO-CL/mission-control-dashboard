import { NextRequest, NextResponse } from 'next/server';
import { shopifyGraphQL } from '@/lib/shopify';

const SEARCH_PRODUCTS_QUERY = `
  query searchProducts($query: String!) {
    products(first: 10, query: $query) {
      edges {
        node {
          id
          title
          variants(first: 10) {
            edges {
              node {
                id
                title
                price
              }
            }
          }
        }
      }
    }
  }
`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  if (!q) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    // Formatear query para Shopify (ej: búsqueda parcial por título)
    // Shopify soporta asteriscos para prefijos, ej: "title:iPhone*"
    const shopifyQuery = `title:${q}*`;

    const data = await shopifyGraphQL(SEARCH_PRODUCTS_QUERY, { query: shopifyQuery });

    // Aplanar los resultados para retornar un arreglo simple de Producto + Variante
    const results: Array<{ id: string; title: string; price: number }> = [];

    const products = data?.products?.edges || [];

    for (const pEdge of products) {
      const product = pEdge.node;
      const variants = product.variants?.edges || [];

      // Si el producto solo tiene "Default Title", devolvemos solo el nombre del producto
      // Si tiene múltiples variantes, agregamos cada variante como un resultado elegible
      for (const vEdge of variants) {
        const variant = vEdge.node;
        const isDefault = variant.title === 'Default Title';
        const displayTitle = isDefault ? product.title : `${product.title} - ${variant.title}`;
        
        results.push({
          id: variant.id,
          title: displayTitle,
          price: parseFloat(variant.price),
        });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error buscando productos en Shopify:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
