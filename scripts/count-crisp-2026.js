require('dotenv').config();

const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function analyzeCrisp() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let count2026 = 0;
  let pageWhereSyncBreaks = -1;

  console.log("Analizando la paginación de Crisp...");

  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });

    if (!res.ok) break;
    const json = await res.json();
    const conversations = json.data;
    if (!conversations || conversations.length === 0) break;

    let page2026 = 0;
    conversations.forEach(c => {
      if (c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS) {
        count2026++;
        page2026++;
      }
    });

    const oldestInPage = conversations[conversations.length - 1];
    
    console.log(`Página ${page}: ${page2026} convers. recientes. Última fecha: ${new Date(oldestInPage.updated_at).toISOString()}`);

    if (pageWhereSyncBreaks === -1 && oldestInPage.updated_at < START_DATE_MS) {
      pageWhereSyncBreaks = page;
      console.log(`---> [ALERTA] El script actual se DETENDRÍA aquí en la pág ${page}`);
    }
  }

  console.log(`\nTotal conversaciones 2026 en las primeras 50 páginas: ${count2026}`);
}

analyzeCrisp();
