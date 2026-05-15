require('dotenv').config();
const { shopifyGraphQL } = require('./scripts/lib/shopify-graphql.js');

async function test() {
  const query = `
    query {
      orders(first: 5, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            name
            metafield(namespace: "custom", key: "estado_de_pedido") {
              value
            }
          }
        }
      }
    }
  `;
  try {
    const res = await shopifyGraphQL(query);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
