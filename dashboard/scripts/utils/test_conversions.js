import { GoogleAdsApi } from 'google-ads-api';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') }); 

async function run() {
  const client = new GoogleAdsApi({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  });

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId) {
    throw new Error('GOOGLE_ADS_CUSTOMER_ID not found in env');
  }

  const customer = client.Customer({
    customer_id: customerId.replace(/-/g, ''),
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  });

  const query = `
    SELECT
      segments.conversion_action_name,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '2026-01-01' AND '2026-12-31'
      AND campaign.status != 'REMOVED'
      AND metrics.conversions > 0
  `;

  try {
    const results = await customer.query(query);
    console.log('Results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}
run();
