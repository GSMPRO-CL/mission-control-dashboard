export async function shopifyGraphQL(query: string, variables: Record<string, any> = {}) {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;

  if (!token || !domain) {
    throw new Error('Missing SHOPIFY_API_TOKEN or SHOPIFY_DOMAIN in environment variables.');
  }

  const url = `https://${domain}/admin/api/2024-01/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    // Asegurar que las consultas como las búsquedas predictivas no queden atrapadas en caché agresivo de Next.js
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Shopify API Error: HTTP ${response.status}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    throw new Error(`GraphQL Error: ${json.errors[0].message}`);
  }

  return json.data;
}
