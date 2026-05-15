require('dotenv').config({ path: '../.env' });
const { GoogleAdsApi } = require('google-ads-api');

async function main() {
  try {
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    
    const customer = client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });
    
    const query = `
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.status,
        conversion_action.type,
        conversion_action.category,
        conversion_action.primary_for_goal
      FROM conversion_action
    `;
    
    const results = await customer.query(query);
    console.log("Conversion Actions:");
    for (const row of results) {
      console.log(`- ${row.conversion_action.name} (Category: ${row.conversion_action.category}, Primary: ${row.conversion_action.primary_for_goal}, Status: ${row.conversion_action.status})`);
    }
  } catch (error) {
    console.error(error);
  }
}

main();
