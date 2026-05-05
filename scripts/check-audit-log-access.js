require('dotenv').config({ path: __dirname + '/../.env' });
const { shopifyGraphQL } = require('./lib/shopify-graphql');

async function runDiagnostics() {
  console.log("=== INICIANDO DIAGNÓSTICO DE ACCESO ===");
  
  let isPlus = false;
  let eventsAccess = 'PENDIENTE';
  let staffAccess = 'PENDIENTE';
  let recommendation = '';

  // Verificación 1 — Plan de la tienda
  try {
    const queryShop = `
      query CheckShop {
        currentAppInstallation {
          id
          accessScopes { handle }
        }
        shop {
          name
          myshopifyDomain
          plan {
            displayName
            partnerDevelopment
            shopifyPlus
          }
        }
      }
    `;
    const result1 = await shopifyGraphQL(queryShop);
    isPlus = result1.shop.plan.shopifyPlus;
  } catch (error) {
    console.error("❌ Error en Verificación 1 (Plan):", error.message);
  }

  // Verificación 2 — Acceso a eventos
  try {
    const queryEvents = `
      query CheckEvents {
        events(first: 5, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              createdAt
              action
              message
              criticalAlert
              appTitle
              ... on BasicEvent {
                subjectType
                subjectId
              }
            }
          }
        }
      }
    `;
    const result2 = await shopifyGraphQL(queryEvents);
    eventsAccess = 'OK';
  } catch (error) {
    eventsAccess = `FALLA: ${error.message}`;
  }

  // Verificación 3 — Acceso a staffMembers
  try {
    const queryStaff = `
      query CheckStaff {
        staffMembers(first: 50) {
          edges {
            node {
              id
              email
              firstName
              lastName
              active
              isShopOwner
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const result3 = await shopifyGraphQL(queryStaff);
    const count = result3.staffMembers.edges.length;
    staffAccess = `OK - ${count} staff detectados`;
  } catch (error) {
    staffAccess = `FALLA: ${error.message}`;
  }

  if (staffAccess.startsWith('OK') && eventsAccess.startsWith('OK')) {
    recommendation = 'Usar Camino 2 (GraphQL staffMembers)';
  } else if (!staffAccess.startsWith('OK') && eventsAccess.startsWith('OK')) {
    recommendation = 'Fallback a Camino 1 (Audit Log)';
  } else {
    recommendation = 'Bloqueado, requiere acción';
  }

  console.log("\n=== DIAGNÓSTICO ===");
  console.log(`Tienda Plus:        ${isPlus ? 'SÍ' : 'NO'}`);
  console.log(`Acceso a events:    ${eventsAccess}`);
  console.log(`Acceso a staff:     ${staffAccess}`);
  console.log(`Recomendación:      ${recommendation}`);
}

runDiagnostics();
