require('dotenv').config({ path: __dirname + '/.env' });
const { shopifyGraphQL } = require('./scripts/lib/shopify-graphql');

async function test() {
  const query = `
    query {
      shop {
        currencyCode
        primaryDomain {
          host
        }
      }
    }
  `;
  const result = await shopifyGraphQL(query);
  console.log(JSON.stringify(result, null, 2));
}
test();
