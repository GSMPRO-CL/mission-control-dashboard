require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const START_DATE = '2026-01-01T00:00:00Z';
const KLAVIYO_API = 'https://a.klaviyo.com/api';

const TARGET_METRICS = [
  'Opened Email',
  'Clicked Email',
  'Unsubscribed',
  'Placed Order'
];

async function fetchKlaviyoMetrics() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const res = await fetch(`${KLAVIYO_API}/metrics/`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/json',
      'revision': '2023-10-15'
    }
  });

  if (!res.ok) throw new Error(`Klaviyo Error: ${res.statusText}`);
  const data = await res.json();
  
  // Filter only the metrics we care about
  const metrics = data.data.filter(m => TARGET_METRICS.includes(m.attributes.name));
  return metrics.map(m => ({ id: m.id, name: m.attributes.name }));
}

async function fetchMetricAggregates(metricId) {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metricId,
        interval: "day",
        measurements: ["count", "sum_value"],
        filter: [`greater-or-equal(datetime,${START_DATE})`, `less-than(datetime,2027-01-01T00:00:00Z)`],
        timezone: "America/Santiago"
      }
    }
  };

  const res = await fetch(`${KLAVIYO_API}/metric-aggregates/`, {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/json',
      'content-type': 'application/json',
      'revision': '2023-10-15'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo Aggregate Error: ${err}`);
  }
  
  const data = await res.json();
  return data.data.attributes; 
}

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  
  const schema = [
    { name: 'date', type: 'TIMESTAMP', mode: 'REQUIRED' },
    { name: 'metric_name', type: 'STRING', mode: 'REQUIRED' },
    { name: 'count', type: 'INT64' },
    { name: 'sum_value', type: 'FLOAT64' }
  ];

  const table = dataset.table('klaviyo_metrics');
  const [exists] = await table.exists();
  if (!exists) {
    console.log("Creando tabla klaviyo_metrics...");
    await dataset.createTable('klaviyo_metrics', { schema });
  } else {
    console.log("Limpiando tabla klaviyo_metrics para carga histórica...");
    try {
      await bq.query(`TRUNCATE TABLE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.klaviyo_metrics\``);
    } catch(e) {}
  }

  return table;
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN KLAVIYO -> BIGQUERY (Histórico 2026) ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const bqTable = await setupBigQuery(bigquery);

    console.log("Obteniendo IDs de métricas desde Klaviyo...");
    const metrics = await fetchKlaviyoMetrics();
    console.log(`Métricas encontradas: ${metrics.map(m => m.name).join(', ')}`);

    let allRows = [];

    for (const metric of metrics) {
      console.log(`Consultando agregados por día para: ${metric.name}...`);
      const attributes = await fetchMetricAggregates(metric.id);
      
      const dates = attributes.dates;
      
      attributes.data.forEach(agg => {
        if (!agg.measurements || !agg.measurements.count) return;
        agg.measurements.count.forEach((countVal, index) => {
           const dateStr = dates[index];
           if (!dateStr) return;
           
           let sumVal = 0;
           if (agg.measurements.sum_value && agg.measurements.sum_value[index]) {
             sumVal = agg.measurements.sum_value[index];
           }

           if (countVal > 0 || sumVal > 0) {
             allRows.push({
               date: bigquery.datetime(dateStr),
               metric_name: metric.name,
               count: countVal,
               sum_value: sumVal
             });
           }
        });
      });
    }

    if (allRows.length === 0) {
      console.log("No hay datos de métricas para insertar.");
      return;
    }

    console.log(`Insertando ${allRows.length} registros agregados diarios en BigQuery...`);
    await bqTable.insert(allRows);
    console.log("✅ Carga de Klaviyo Completada con Éxito.");

  } catch (err) {
    console.error("❌ Error en sincronización Klaviyo:", err);
  }
}

runSync();
