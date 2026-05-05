require('dotenv').config();

const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function testPages() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let page = 1;
  let keepFetching = true;

  console.log("Comprobando páginas...");

  for (let page = 1; page <= 100; page++) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });

    if (!res.ok) break;
    const json = await res.json();
    const conversations = json.data;
    if (!conversations || conversations.length === 0) break;

    const hasRecent = conversations.some(c => c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS);
    
    if (hasRecent) {
      console.log(`Página ${page} TIENE conversaciones recientes.`);
    }
  }
}

testPages();
