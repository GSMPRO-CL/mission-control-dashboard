require('dotenv').config();
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { BigQuery } = require('@google-cloud/bigquery');

// Configuración
const PROPERTY_ID = process.env.GA4_PROPERTY_ID;
const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'raw_traffic_ga4';
const PROJECT_ID = process.env.GCP_PROJECT_ID;

// Por defecto extraemos los últimos 30 días, o histórico completo si está vacío
const START_DATE = '2026-01-01'; // Ajustado para el historial de nuestro sistema
const END_DATE = 'today';

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);
  
  const [exists] = await table.exists();
  if (!exists) {
    console.log(`Creando tabla ${TABLE_ID}...`);
    const ddl = `
      CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` (
          date DATE NOT NULL,
          session_default_channel_group STRING,
          session_source_medium STRING,
          campaign_name STRING,
          sessions INT64,
          total_users INT64,
          new_users INT64,
          engagement_rate FLOAT64,
          average_session_duration FLOAT64,
          conversions INT64,
          ecommerce_purchases INT64,
          purchase_revenue FLOAT64,
          add_to_carts INT64,
          _ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY date
      OPTIONS(
          description="Tabla cruda con métricas diarias de tráfico y e-commerce extraídas de Google Analytics 4 (GA4)",
          require_partition_filter=false
      );
    `;
    await bq.query(ddl);
    console.log(`✅ Tabla ${TABLE_ID} creada exitosamente.`);
  }
  
  // Limpiamos la tabla para esta demostración de carga histórica
  console.log(`Limpiando tabla ${TABLE_ID} para carga idempotente...`);
  try {
    await bq.query(`TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``);
  } catch(e) {
    console.log("Aviso en TRUNCATE:", e.message);
  }

  return table;
}

async function fetchGA4Data() {
  console.log(`Conectando a GA4 Propiedad: ${PROPERTY_ID}...`);
  // Inicializamos el cliente de GA4 usando el service account key explícitamente
  const analyticsDataClient = new BetaAnalyticsDataClient({
    keyFilename: 'google_analytics.json'
  });

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${PROPERTY_ID}`,
    dateRanges: [
      {
        startDate: START_DATE,
        endDate: END_DATE,
      },
    ],
    dimensions: [
      { name: 'date' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionSourceMedium' },
      { name: 'campaignName' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'conversions' },
      { name: 'ecommercePurchases' },
      { name: 'purchaseRevenue' }
      // add_to_carts podría no estar disponible por defecto sin eventos de e-commerce avanzados
    ],
  });

  console.log(`Se obtuvieron ${response.rows.length} filas de GA4.`);
  return response.rows;
}

function parseGA4Row(row) {
  // Dimensiones: date, sessionDefaultChannelGroup, sessionSourceMedium, campaignName
  const dateStr = row.dimensionValues[0].value;
  // Convertir YYYYMMDD a YYYY-MM-DD
  const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  
  const session_default_channel_group = row.dimensionValues[1].value;
  const session_source_medium = row.dimensionValues[2].value;
  const campaign_name = row.dimensionValues[3].value;

  // Métricas: sessions, totalUsers, newUsers, engagementRate, averageSessionDuration, conversions, ecommercePurchases, purchaseRevenue
  const sessions = parseInt(row.metricValues[0].value || '0', 10);
  const total_users = parseInt(row.metricValues[1].value || '0', 10);
  const new_users = parseInt(row.metricValues[2].value || '0', 10);
  const engagement_rate = parseFloat(row.metricValues[3].value || '0');
  const average_session_duration = parseFloat(row.metricValues[4].value || '0');
  const conversions = parseInt(row.metricValues[5].value || '0', 10);
  const ecommerce_purchases = parseInt(row.metricValues[6].value || '0', 10);
  const purchase_revenue = parseFloat(row.metricValues[7].value || '0');

  return {
    date: formattedDate,
    session_default_channel_group,
    session_source_medium,
    campaign_name,
    sessions,
    total_users,
    new_users,
    engagement_rate,
    average_session_duration,
    conversions,
    ecommerce_purchases,
    purchase_revenue,
    add_to_carts: 0, // Placeholder si no está en GA4 base
    _ingested_at: new Date().toISOString()
  };
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN GA4 -> BIGQUERY ===");
  try {
    const bigquery = new BigQuery({ projectId: PROJECT_ID });
    const bqTable = await setupBigQuery(bigquery);

    const ga4Rows = await fetchGA4Data();
    
    if (ga4Rows.length === 0) {
       console.log("No hay datos de GA4 para insertar.");
       return;
    }

    const rowsToInsert = ga4Rows.map(parseGA4Row);
    
    console.log(`Insertando ${rowsToInsert.length} registros en BigQuery...`);
    
    // Batch insert (BigQuery can handle up to 10k rows easily, we send in one batch here)
    const chunkSize = 1000;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      await bqTable.insert(chunk);
    }
    
    console.log("✅ Carga de GA4 Completada con Éxito.");

  } catch (err) {
    console.error("❌ Error en sincronización GA4:", err);
  }
}

runSync();
