require('dotenv').config();

const KLAVIYO_API = 'https://a.klaviyo.com/api';

async function test() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const res = await fetch(`${KLAVIYO_API}/flows/`, {
    headers: {
      'Authorization': `Klaviyo-API-Key ${apiKey}`,
      'accept': 'application/json',
      'revision': '2023-10-15'
    }
  });

  if (!res.ok) {
    console.error("Error:", await res.text());
    return;
  }
  const data = await res.json();
  console.log("Flows:", data.data.slice(0, 3));
}

test();
