require('dotenv').config();

async function testOrder() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let page = 1;
  let previousOldest = Infinity;
  let outOfOrderCount = 0;

  console.log("Comprobando si Crisp ordena estrictamente por updated_at descendente...");

  while (page <= 20) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
      headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
    });

    if (!res.ok) break;

    const json = await res.json();
    const conversations = json.data;

    if (!conversations || conversations.length === 0) break;

    for (const c of conversations) {
      if (c.updated_at > previousOldest) {
        console.log(`Desorden encontrado! En la página ${page}, session ${c.session_id} tiene updated_at ${c.updated_at} que es MAYOR que el anterior ${previousOldest}`);
        outOfOrderCount++;
      }
      previousOldest = c.updated_at;
    }
    
    page++;
  }
  
  console.log(`Prueba finalizada. Elementos fuera de orden encontrados: ${outOfOrderCount}`);
}

testOrder();
