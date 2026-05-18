const { BetaAnalyticsDataClient } = require('@google-analytics/data');
require('dotenv').config();

async function listMetrics() {
  const analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: process.env.GA4_REFRESH_TOKEN,
      type: "authorized_user"
    }
  });

  const propertyId = process.env.GA4_PROPERTY_ID;
  const [metadata] = await analyticsDataClient.getMetadata({
    name: `properties/${propertyId}/metadata`,
  });

  const ecommerceMetrics = metadata.metrics.filter(m => 
    m.apiName.toLowerCase().includes('cart') || 
    m.apiName.toLowerCase().includes('checkout') || 
    m.apiName.toLowerCase().includes('view') ||
    m.apiName.toLowerCase().includes('purchase')
  ).map(m => m.apiName);
  
  console.log(ecommerceMetrics.join('\n'));
}

listMetrics().catch(console.error);
