require('dotenv').config();

const START_DATE = '2026-04-01T00:00:00Z';
const KLAVIYO_API = 'https://a.klaviyo.com/api';

async function debug() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;

  const res1 = await fetch(`${KLAVIYO_API}/metrics/`, {
    headers: { 'Authorization': `Klaviyo-API-Key ${apiKey}`, 'accept': 'application/json', 'revision': '2023-10-15' }
  });
  const mdata = await res1.json();
  const poMetric = mdata.data.find(m => m.attributes.name === 'Placed Order');
  
  if (!poMetric) {
    console.log("No Placed Order metric found");
    return;
  }

  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: poMetric.id,
        interval: "day",
        measurements: ["count", "sum_value"],
        by: ["Campaign Name", "$attributed_message"],
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
  if (data.errors) {
    console.error("Errors:", JSON.stringify(data.errors, null, 2));
  } else {
    // Show top 5 dimensions combinations
    const results = data.data.attributes.data;
    const sorted = results.sort((a,b) => {
      const sumA = a.measurements.sum_value.reduce((acc, val) => acc + val, 0);
      const sumB = b.measurements.sum_value.reduce((acc, val) => acc + val, 0);
      return sumB - sumA;
    });
    console.log("Placed Order aggregates:");
    console.log(JSON.stringify(sorted.slice(0, 5), null, 2));
  }
}

debug();
