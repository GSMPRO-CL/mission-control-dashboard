require('dotenv').config({ path: '../../.env' });
const { GoogleAdsApi } = require('google-ads-api');

async function run() {
  try {
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    const customer = client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, ''),
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });

    const query = `
      SELECT
        segments.conversion_action_name,
        segments.conversion_action_category,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '2026-04-01' AND '2026-04-30'
        AND metrics.conversions > 0
    `;

    const results = await customer.query(query);
    const map = {};
    for (const row of results) {
      const name = row.segments.conversion_action_name;
      const cat = row.segments.conversion_action_category;
      const convs = row.metrics.conversions;
      if (!map[name]) map[name] = { category: cat, conversions: 0 };
      map[name].conversions += convs;
    }
    console.log(JSON.stringify(map, null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
