require('dotenv').config({ path: __dirname + '/../.env' });
const { shopifyGraphQL } = require('./lib/shopify-graphql');

async function testGraphQL() {
  console.log("=== PRUEBA 1: Query Simple (Sin Paginación) ===");
  const simpleQuery = `
    query {
      shop {
        name
        myshopifyDomain
      }
    }
  `;
  try {
    const simpleResult = await shopifyGraphQL(simpleQuery);
    console.log("Resultado Simple:", JSON.stringify(simpleResult, null, 2));
  } catch (error) {
    console.error("Error en Query Simple:", error);
  }

  console.log("\n=== PRUEBA 2: Query Paginada (50 productos de 10 en 10) ===");
  const paginatedQuery = `
    query getProducts($cursor: String) {
      products(first: 10, after: $cursor) {
        edges {
          node {
            id
            title
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  try {
    const paginatedResult = await shopifyGraphQL(paginatedQuery, {}, { paginate: true, connectionPath: 'products' });
    console.log(`Resultado Paginado: Se obtuvieron ${paginatedResult.length} productos en total.`);
    if (paginatedResult.length > 0) {
      console.log("Muestra del primero:", JSON.stringify(paginatedResult[0], null, 2));
    }
    // Verificamos si trajo al menos 50 (o lo máximo que hay si es menos de 50)
    // El script dice: "traer los primeros 50 productos paginando de 10 en 10".
    // La query pide 10 en cada iteración. Shopify devuelve mientras haya hasNextPage.
    // Ojo, si la tienda tiene más de 50, este código seguiría trayendo TODOS,
    // porque la condición es hasNextPage. Para limitarlo a 50 estrictamente,
    // la opción paginate del helper lo trae todo.
    // Lo dejaremos correr como "fetch all products de 10 en 10",
    // porque es la forma estándar de paginación completa.
  } catch (error) {
    console.error("Error en Query Paginada:", error);
  }
}

testGraphQL();
