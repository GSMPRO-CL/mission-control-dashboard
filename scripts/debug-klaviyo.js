require('dotenv').config();

const START_DATE = '2026-01-01T00:00:00Z';
const KLAVIYO_API = 'https://a.klaviyo.com/api';
// Usaremos "Clicked Email" que es la primera que vimos que existe.
const METRIC_ID = 'WvS7qW'; // Lo haré dinámico.

async function debugKlaviyo() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  
  // Buscar Metric ID primero
  const res1 = await fetch(`${KLAVIYO_API}/metrics/`, {
    headers: { 'Authorization': `Klaviyo-API-Key ${apiKey}`, 'accept': 'application/json', 'revision': '2023-10-15' }
  });
  const mdata = await res1.json();
  const metric = mdata.data.find(m => m.attributes.name === 'Clicked Email');

  console.log("Metric ID:", metric.id);

  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metric.id,
        interval: "day",
        measurements: ["count", "sum_value"],
        filter: [`greater-or-equal(datetime,${START_DATE})`, `less-than(datetime,2027-01-01T00:00:00Z)`],
        timezone: "America/Santiago"
      }
    }
  };

  const res = await fetch(`${KLAVIYO_API}/metric-aggregates/`, {
    method: 'POST',
    headers: { 'Authorization': `Klaviyo-API-Key ${apiKey}`, 'accept': 'application/json', 'content-type': 'application/json', 'revision': '2023-10-15' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  console.log(JSON.stringify(data.data.attributes.data[0], null, 2));
  console.log(JSON.stringify(data.data.attributes.dates, null, 2));
}

debugKlaviyo();
