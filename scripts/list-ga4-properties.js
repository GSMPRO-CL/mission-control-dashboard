const { AnalyticsAdminServiceClient } = require('@google-analytics/admin');
async function main() {
  const adminClient = new AnalyticsAdminServiceClient({
    keyFilename: 'google_analytics.json'
  });
  
  const [accounts] = await adminClient.listAccountSummaries();
  console.log("Accounts:");
  for (const account of accounts) {
    console.log(`Account: ${account.name}`);
    for (const property of account.propertySummaries) {
      console.log(`- Property Name: ${property.property}, Display Name: ${property.displayName}`);
    }
  }
}
main().catch(console.error);
