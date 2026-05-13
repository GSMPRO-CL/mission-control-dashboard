require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';
const KLAVIYO_API = 'https://a.klaviyo.com/api';

const TARGET_METRICS = [
  'Opened Email',
  'Clicked Email',
  'Unsubscribed',
  'Placed Order',
  'Bounced Email',
  'Dropped Email',
  'Subscribed to List',
  'Received Email'
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

async function fetchKlaviyoFlows() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  let hasNext = true;
  let url = `${KLAVIYO_API}/flows/`;
  const flowsMap = {};

  while (hasNext) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'accept': 'application/json',
        'revision': '2023-10-15'
      }
    });

    if (!res.ok) throw new Error(`Klaviyo Flows Error: ${res.statusText}`);
    const data = await res.json();
    
    data.data.forEach(f => {
      flowsMap[f.id] = f.attributes.name;
    });

    if (data.links && data.links.next) {
      url = data.links.next;
    } else {
      hasNext = false;
    }
  }

  return flowsMap;
}

async function fetchKlaviyoCampaigns() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  let hasNext = true;
  let url = `${KLAVIYO_API}/campaigns/?filter=equals(messages.channel,"email")`;
  const campaignsMap = {};

  while (hasNext) {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'accept': 'application/json',
        'revision': '2023-10-15'
      }
    });

    if (!res.ok) throw new Error(`Klaviyo Campaigns Error: ${res.statusText}`);
    const data = await res.json();
    
    data.data.forEach(c => {
      campaignsMap[c.id] = c.attributes.name;
    });

    if (data.links && data.links.next) {
      url = data.links.next;
    } else {
      hasNext = false;
    }
  }

  return campaignsMap;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMetricAggregates(metricId, startDate, endDate) {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metricId,
        interval: "day",
        measurements: ["count", "sum_value"],
        by: ["$attributed_message", "$attributed_flow"],
        filter: [`greater-or-equal(datetime,${startDate})`, `less-than(datetime,${endDate})`],
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
    { name: 'campaign_name', type: 'STRING' },
    { name: 'flow_name', type: 'STRING' },
    { name: 'count', type: 'INT64' },
    { name: 'sum_value', type: 'FLOAT64' }
  ];

  const table = dataset.table('klaviyo_metrics');
  const [exists] = await table.exists();
  
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const START_DATE = thirtyDaysAgo.toISOString();
  const END_DATE = now.toISOString();

  if (exists) {
    console.log(`Eliminando registros a partir de ${START_DATE} para carga incremental...`);
    const query = `DELETE FROM \`${bq.projectId}.${DATASET_ID}.klaviyo_metrics\` WHERE date >= TIMESTAMP('${START_DATE}')`;
    await bq.query(query);
  } else {
    console.log("Creando tabla klaviyo_metrics...");
    await dataset.createTable('klaviyo_metrics', { schema });
  }
  
  return { table: dataset.table('klaviyo_metrics'), startDate: START_DATE, endDate: END_DATE };
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN KLAVIYO -> BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const { table: bqTable, startDate, endDate } = await setupBigQuery(bigquery);

    console.log("Obteniendo diccionario de Flows desde Klaviyo...");
    const flowsMap = await fetchKlaviyoFlows();
    console.log(`Se mapearon ${Object.keys(flowsMap).length} flows.`);

    console.log("Obteniendo diccionario de Campañas desde Klaviyo...");
    const campaignsMap = await fetchKlaviyoCampaigns();
    console.log(`Se mapearon ${Object.keys(campaignsMap).length} campañas.`);

    console.log("Obteniendo IDs de métricas desde Klaviyo...");
    const metrics = await fetchKlaviyoMetrics();
    console.log(`Métricas encontradas: ${metrics.map(m => m.name).join(', ')}`);

    let allRows = [];

    for (const metric of metrics) {
      console.log(`Consultando agregados por día para: ${metric.name}...`);
      await sleep(1500); // Evitar rate limits
      const attributes = await fetchMetricAggregates(metric.id, startDate, endDate);
      
      const dates = attributes.dates;
      
      attributes.data.forEach(agg => {
        const attributedMessage = agg.dimensions && agg.dimensions.length > 0 ? agg.dimensions[0] : '';
        const attributedFlow = agg.dimensions && agg.dimensions.length > 1 ? agg.dimensions[1] : '';

        let campaignName = "";
        let flowName = "";

        if (attributedFlow) {
          // Si hay attributedFlow, es un Flow
          if (flowsMap[attributedFlow]) {
            flowName = flowsMap[attributedFlow];
          } else {
            flowName = `(ID: ${attributedFlow})`; // Flow eliminado o desconocido
          }
        } else if (attributedMessage) {
          // Si no hay attributedFlow pero hay attributedMessage, es una Campaña
          if (campaignsMap[attributedMessage]) {
            campaignName = campaignsMap[attributedMessage];
          } else {
            campaignName = `(ID: ${attributedMessage})`; // Campaña eliminada o de otro canal
          }
        }

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
               campaign_name: campaignName,
               flow_name: flowName,
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
