const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { BigQuery } = require('@google-cloud/bigquery');

// Configuración
const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'raw_traffic_ga4';

// Por defecto extraemos los últimos 30 días, o histórico completo si está vacío
const START_DATE = '2026-01-01'; // Ajustado para el historial de nuestro sistema
const END_DATE = 'today';

async function setupBigQuery(bq, projectId) {
  const dataset = bq.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);
  
  const [exists] = await table.exists();
  if (!exists) {
    console.log(`Creando tabla ${TABLE_ID}...`);
    const ddl = `
      CREATE TABLE IF NOT EXISTS \`${projectId}.${DATASET_ID}.${TABLE_ID}\` (
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
  
  // Limpiamos la tabla para carga idempotente
  console.log(`Limpiando tabla ${TABLE_ID} para carga idempotente...`);
  try {
    await bq.query(`TRUNCATE TABLE \`${projectId}.${DATASET_ID}.${TABLE_ID}\``);
  } catch(e) {
    console.log("Aviso en TRUNCATE:", e.message);
  }

  return table;
}

async function fetchGA4Data(propertyId) {
  console.log(`Conectando a GA4 Propiedad: ${propertyId}...`);
  // Usamos autenticación nativa (Application Default Credentials)
  const analyticsDataClient = new BetaAnalyticsDataClient();

  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
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
    ],
  });

  console.log(`Se obtuvieron ${response.rows.length} filas de GA4.`);
  return response.rows;
}

function parseGA4Row(row) {
  const dateStr = row.dimensionValues[0].value;
  const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  
  const session_default_channel_group = row.dimensionValues[1].value;
  const session_source_medium = row.dimensionValues[2].value;
  const campaign_name = row.dimensionValues[3].value;

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
    add_to_carts: 0,
    _ingested_at: new Date().toISOString()
  };
}

exports.syncGA4 = async (req, res) => {
  console.log("=== INICIANDO EXTRACCIÓN GA4 -> BIGQUERY (Cloud Function) ===");
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const propertyId = process.env.GA4_PROPERTY_ID;

    if (!projectId || !propertyId) {
      throw new Error('Variables de entorno GCP_PROJECT_ID o GA4_PROPERTY_ID no definidas.');
    }

    const bigquery = new BigQuery({ projectId });
    const bqTable = await setupBigQuery(bigquery, projectId);

    const ga4Rows = await fetchGA4Data(propertyId);
    
    if (ga4Rows.length === 0) {
       console.log("No hay datos de GA4 para insertar.");
       return res.status(200).json({ success: true, message: "No hay datos", records: 0 });
    }

    const rowsToInsert = ga4Rows.map(parseGA4Row);
    console.log(`Insertando ${rowsToInsert.length} registros en BigQuery...`);
    
    const chunkSize = 1000;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      await bqTable.insert(chunk);
    }
    
    console.log("✅ Carga de GA4 Completada con Éxito.");
    res.status(200).json({ success: true, records: rowsToInsert.length });
  } catch (err) {
    console.error("❌ Error en sincronización GA4:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
