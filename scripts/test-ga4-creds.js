const { BetaAnalyticsDataClient } = require('@google-analytics/data');
require('dotenv').config();

async function test() {
  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GA4_REFRESH_TOKEN,
      type: "authorized_user"
    }
  });

  const propertyId = process.env.GA4_PROPERTY_ID;
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [
      {
        startDate: '2026-05-10',
        endDate: 'today',
      },
    ],
    dimensions: [
      { name: 'date' }
    ],
    metrics: [
      { name: 'sessions' }
    ],
  });

  console.log('Success!', response.rows.length);
}

test().catch(console.error);
