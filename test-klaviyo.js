require('dotenv').config();
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function test() {
  const res1 = await fetch(`https://a.klaviyo.com/api/metrics/`, {
    headers: { 'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`, 'revision': '2023-10-15' }
  });
  const data1 = await res1.json();
  const opened = data1.data.find(m => m.attributes.name === 'Opened Email');
  
  const byFields = ['Campaign Name', '$attributed_flow'];
  
  const payload = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: opened.id,
        interval: "day",
        measurements: ["count"],
        by: byFields,
        filter: [`greater-or-equal(datetime,2026-03-01T00:00:00Z)`, `less-than(datetime,2026-04-01T00:00:00Z)`],
        timezone: "America/Santiago"
      }
    }
  };
  
  const res2 = await fetch(`https://a.klaviyo.com/api/metric-aggregates/`, {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_API_KEY}`,
      'accept': 'application/json',
      'content-type': 'application/json',
      'revision': '2023-10-15'
    },
    body: JSON.stringify(payload)
  });
  const data2 = await res2.json();
  if (data2.errors) {
    console.log("Error", data2.errors[0].detail);
  } else {
    console.log("Success! Groups:", data2.data.attributes.data.length);
    console.log(JSON.stringify(data2.data.attributes.data[0].dimensions));
  }
}
test().catch(console.error);
