require('dotenv').config();

const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function fastScan() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let total2026 = 0;
  let page = 1;

  console.log("Escaneando exhaustivamente sin detenerse...");

  while (true) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });

    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!res.ok) break;
    const json = await res.json();
    const conversations = json.data;
    if (!conversations || conversations.length === 0) break;

    let foundInPage = 0;
    conversations.forEach(c => {
      if (c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS) {
        total2026++;
        foundInPage++;
      }
    });

    if (page % 10 === 0 || foundInPage > 0) {
      process.stdout.write(`\rPág ${page} | 2026 encontrados: ${total2026}`);
    }

    page++;
    await new Promise(r => setTimeout(r, 100)); // anti rate-limit
  }

  console.log(`\nEscaneo completado. Total de conversaciones de 2026 encontradas: ${total2026}`);
}

fastScan();
