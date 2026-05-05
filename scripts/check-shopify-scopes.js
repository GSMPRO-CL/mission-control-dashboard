require('dotenv').config();

const REQUIRED_SCOPES = [
  'read_products',
  'read_product_listings',
  'read_users',
  'read_content',
  'read_themes',
  'read_publications',
  'read_locales'
];

async function checkScopes() {
  console.log("=== VERIFICANDO SCOPES DE SHOPIFY ===");
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;

  if (!token || !domain) {
    console.error("❌ Faltan credenciales en el archivo .env (SHOPIFY_API_TOKEN o SHOPIFY_DOMAIN)");
    process.exit(1);
  }

  const url = `https://${domain}/admin/api/2024-10/graphql.json`;
  const query = `
    query {
      currentAppInstallation {
        accessScopes {
          handle
        }
      }
    }
  `;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ Error HTTP ${response.status}: ${response.statusText}`);
      console.error(text);
      process.exit(1);
    }

    const data = await response.json();

    if (data.errors) {
      console.error("❌ Error de GraphQL devuelto por Shopify:");
      console.error(JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    const currentScopes = data.data.currentAppInstallation.accessScopes.map(scope => scope.handle);
    
    console.log("\n✅ Scopes actuales activos:");
    currentScopes.forEach(scope => console.log(`  - ${scope}`));

    const missingScopes = REQUIRED_SCOPES.filter(scope => !currentScopes.includes(scope));

    console.log("\n=== RESULTADO DE VALIDACIÓN ===");
    if (missingScopes.length > 0) {
      console.error(`❌ FALTAN SCOPES: ${missingScopes.join(', ')}`);
      console.error("Por favor agregar en admin Shopify → Apps → [nombre app] → Configuración → API access scopes.");
    } else {
      console.log("✅ Todos los scopes requeridos para el módulo de atribución están activos.");
    }

  } catch (error) {
    console.error("❌ Error durante la verificación:", error.message);
    process.exit(1);
  }
}

checkScopes();
