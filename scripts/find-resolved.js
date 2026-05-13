require('dotenv').config();
const identifier = process.env.CRISP_IDENTIFIER;
const key = process.env.CRISP_KEY;
const websiteId = process.env.CRISP_WEBSITE_ID;
const auth = Buffer.from(`${identifier}:${key}`).toString('base64');

async function findResolved() {
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });
    if (!res.ok) break;
    const json = await res.json();
    if (!json.data || json.data.length === 0) break;
    
    const resolved = json.data.find(c => c.status === 2 || c.state === 'resolved');
    if (resolved) {
      console.log('FOUND RESOLVED CONVERSATION:');
      console.log(JSON.stringify(resolved, null, 2));
      return;
    }
  }
  console.log('No resolved conversations found in first 50 pages.');
}

findResolved();
