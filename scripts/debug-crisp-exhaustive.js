require('dotenv').config();

const START_DATE_MS = new Date('2026-01-01T00:00:00Z').getTime();

async function exhaustiveCrispAudit() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  let allConversations = [];
  const filters = ['', 'filter_not_resolved=1', 'filter_resolved=1'];

  console.log("=== AUDITORÍA EXHAUSTIVA DE CRISP API ===");
  console.log("Vamos a buscar página por página sin detenernos por fecha hasta que Crisp devuelva vacío.\n");

  // Primero probemos sin filtros
  let page = 1;
  let keepFetching = true;
  console.log(`Probando extracción SIN FILTROS (default)...`);
  
  while (keepFetching) {
    let res;
    let retries = 3;
    while (retries > 0) {
      res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/${page}`, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'X-Crisp-Tier': 'plugin'
        }
      });
      if (res.status === 429) {
        process.stdout.write(`\rRate limit alcanzado. Esperando 5 segundos...`);
        await new Promise(r => setTimeout(r, 5000));
        retries--;
      } else {
        break;
      }
    }

    if (!res.ok) {
      if (res.status === 404) break;
      throw new Error(`Crisp Error: ${res.statusText}`);
    }

    // Delay base de 300ms entre llamadas
    await new Promise(r => setTimeout(r, 300));

    const json = await res.json();
    const conversations = json.data;

    if (!conversations || conversations.length === 0) {
      break;
    }

    allConversations = allConversations.concat(conversations);
    process.stdout.write(`\rPágina ${page} | Descargadas acumuladas: ${allConversations.length}...`);
    
    page++;
    
    // Safety break
    if (page > 1500) break; 
  }

  console.log(`\nExtracción total finalizada. Obtenidas ${allConversations.length} conversaciones en total histórico.`);

  // Análisis de fechas
  let count2026 = 0;
  let states = {};
  let oldestDate = Date.now();
  
  allConversations.forEach(c => {
    if (c.created_at >= START_DATE_MS || c.updated_at >= START_DATE_MS) {
      count2026++;
    }
    if (c.created_at < oldestDate) oldestDate = c.created_at;
    
    const st = c.state || c.status || 'unknown';
    states[st] = (states[st] || 0) + 1;
  });

  console.log("\n--- RESULTADOS DEL ANÁLISIS ---");
  console.log(`Conversaciones de 2026 encontradas: ${count2026}`);
  console.log(`Fecha más antigua extraída: ${new Date(oldestDate).toISOString()}`);
  console.log(`Desglose por estado de todas las extraídas:`, states);

  // Si sin filtros obtuvimos pocas, intentamos la estrategia de búsqueda por fecha (Search API)
  // Crisp Search API: GET /v1/website/{website_id}/conversations/{page}?search_query=... & search_type=...
  // Pero la API de búsqueda puede requerir un plugin de pago. Probemos si funciona:
  console.log("\nIntentando con el endpoint de búsqueda (Search API)...");
  try {
     const searchRes = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/1?search_query=&filter_date_start=${new Date('2026-01-01T00:00:00Z').toISOString()}`, {
       headers: { 'Authorization': `Basic ${auth}`, 'X-Crisp-Tier': 'plugin' }
     });
     
     if (searchRes.ok) {
        const searchJson = await searchRes.json();
        console.log("El endpoint de búsqueda con fechas funciona. Resultados en pág 1:", searchJson.data ? searchJson.data.length : 0);
     } else {
        console.log("El endpoint de búsqueda falló o no soporta filtros de fecha así:", searchRes.status, searchRes.statusText);
     }
  } catch(e) {}
}

exhaustiveCrispAudit();
