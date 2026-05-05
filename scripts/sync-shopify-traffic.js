require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const TARGET_TABLE = 'shopify_traffic_daily';

// This is a scaffold. In the future, it will be connected to Google Analytics 4 API 
// or Shopify Analytics to fetch actual Traffic Data.
async function fetchGA4TrafficData() {
  console.log("Fetching traffic data... (Mocking until GA4 is connected)");
  const rows = [];
  const today = new Date();
  
  // Generate last 30 days of mock data
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Simulate some realistic-looking traffic metrics
    const sessions = Math.floor(Math.random() * 500) + 1000;
    rows.push({
      date: dateStr,
      total_sessions: sessions,
      unique_visitors: Math.floor(sessions * 0.8),
      pageviews: sessions * Math.floor(Math.random() * 3 + 2),
      bounce_rate: (Math.random() * 20 + 40) // between 40% and 60%
    });
  }
  return rows;
}

async function runSync() {
  console.log("=== INICIANDO SINCRONIZACIÓN TRÁFICO (SHOPiFY/GA4) -> BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    
    const trafficData = await fetchGA4TrafficData();
    
    if (trafficData.length === 0) {
      console.log("No hay datos de tráfico para procesar.");
      return;
    }

    const tablePath = `\`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.${TARGET_TABLE}\``;
    
    // Simple MERGE based on date to overwrite existing data for that day
    for (const row of trafficData) {
      const query = `
        MERGE ${tablePath} T
        USING (SELECT DATE('${row.date}') as date, ${row.total_sessions} as total_sessions, ${row.unique_visitors} as unique_visitors, ${row.pageviews} as pageviews, ${row.bounce_rate} as bounce_rate) S
        ON T.date = S.date
        WHEN MATCHED THEN
          UPDATE SET 
            total_sessions = S.total_sessions,
            unique_visitors = S.unique_visitors,
            pageviews = S.pageviews,
            bounce_rate = S.bounce_rate
        WHEN NOT MATCHED THEN
          INSERT (date, total_sessions, unique_visitors, pageviews, bounce_rate)
          VALUES (S.date, S.total_sessions, S.unique_visitors, S.pageviews, S.bounce_rate)
      `;
      await bigquery.query({ query });
    }
    
    console.log(`✅ Sincronización de Tráfico insertada/actualizada con éxito en ${TARGET_TABLE}.`);

  } catch (err) {
    console.error("❌ Error durante la sincronización de tráfico:", err);
  }
}

runSync();
