require('dotenv').config({ path: __dirname + '/../.env' });
const { shopifyGraphQL } = require('./lib/shopify-graphql');
const fs = require('fs');

async function inspectEvents() {
  console.log("=== INICIANDO INSPECCIÓN RÁPIDA DE EVENTOS SHOPIFY ===");
  
  let allEvents = [];
  let hasNextPage = true;
  let cursor = null;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 30);
  const MAX_EVENTS = 1000;
  
  let reachedMax = false;
  let reachedDate = false;

  const query = `
    query InspectEvents($cursor: String) {
      events(first: 100, sortKey: CREATED_AT, reverse: true, after: $cursor) {
        edges {
          cursor
          node {
            id
            createdAt
            action
            message
            appTitle
            attributeToApp
            attributeToUser
            criticalAlert
            ... on BasicEvent {
              subjectType
              subjectId
            }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `;

  try {
    while (hasNextPage && allEvents.length < MAX_EVENTS && !reachedDate) {
      // Usamos fetch directo para tener control fino sobre los límites y fechas,
      // pero el helper shopifyGraphQL ya maneja paginación si se lo pedimos.
      // Sin embargo, para frenar a 1000 eventos o 30 días, lo haremos manual aquí,
      // llamando al helper sin `paginate: true` en cada request.
      const result = await shopifyGraphQL(query, { cursor }, { paginate: false });
      
      if (!result.events || !result.events.edges) {
        throw new Error("No se pudo obtener events de GraphQL.");
      }

      const edges = result.events.edges;
      if (edges.length === 0) break;

      for (const edge of edges) {
        const eventDate = new Date(edge.node.createdAt);
        if (eventDate < targetDate) {
          reachedDate = true;
          break;
        }
        allEvents.push(edge.node);
        if (allEvents.length >= MAX_EVENTS) {
          reachedMax = true;
          break;
        }
      }

      hasNextPage = result.events.pageInfo.hasNextPage;
      cursor = result.events.pageInfo.endCursor;
    }

    // Save RAW JSON
    fs.writeFileSync('/tmp/shopify-events-raw.json', JSON.stringify(allEvents, null, 2));
    console.log(`\n💾 Raw JSON guardado en /tmp/shopify-events-raw.json`);

    // AGGREGATIONS
    if (reachedMax && !reachedDate) {
      console.log(`\n⚠️ ADVERTENCIA: Se alcanzó el límite de ${MAX_EVENTS} eventos antes de cubrir los 30 días.`);
    }

    if (allEvents.length === 0) {
      console.log("No se encontraron eventos.");
      return;
    }

    const firstDate = new Date(allEvents[allEvents.length - 1].createdAt);
    const lastDate = new Date(allEvents[0].createdAt);

    console.log(`\n=== REPORTE AGREGADO ===`);
    console.log(`Volumen total detectado: ${allEvents.length} eventos`);
    console.log(`Rango de fechas:         ${firstDate.toISOString().split('T')[0]} hasta ${lastDate.toISOString().split('T')[0]}`);

    // Distribución por subjectType
    const subjectTypes = {};
    const actions = {};
    let countHuman = 0;
    let countApp = 0;
    let countNone = 0;
    const apps = {};
    const eventsPerDayHuman = {};
    const humanEvents = [];
    const gidParams = new Set();

    for (const event of allEvents) {
      // Subject Type
      const st = event.subjectType || 'UNKNOWN';
      subjectTypes[st] = (subjectTypes[st] || 0) + 1;

      // Action
      const act = event.action || 'UNKNOWN';
      actions[act] = (actions[act] || 0) + 1;

      // Attribution
      if (event.attributeToUser) {
        countHuman++;
        humanEvents.push(event);
        
        // Distribution temporal (solo humanos)
        const dateKey = event.createdAt.split('T')[0];
        eventsPerDayHuman[dateKey] = (eventsPerDayHuman[dateKey] || 0) + 1;
      } else if (event.attributeToApp) {
        countApp++;
        const appTitle = event.appTitle || 'Unknown App';
        apps[appTitle] = (apps[appTitle] || 0) + 1;
      } else {
        countNone++;
      }

      // GID Analysis (look for ? query params or structured stuff)
      const idStr = event.id || '';
      if (idStr.includes('?')) {
        const parts = idStr.split('?');
        if (parts.length > 1) {
          gidParams.add(`?${parts[1]}`);
        }
      }
    }

    // Print SubjectType
    console.log(`\n--- Distribución por subject_type ---`);
    Object.keys(subjectTypes).sort((a,b) => subjectTypes[b] - subjectTypes[a]).forEach(k => {
      console.log(`${k.padEnd(20)} ${subjectTypes[k]}`);
    });

    // Print Action
    console.log(`\n--- Distribución por action ---`);
    Object.keys(actions).sort((a,b) => actions[b] - actions[a]).forEach(k => {
      console.log(`${k.padEnd(20)} ${actions[k]}`);
    });

    // Attribution
    console.log(`\n--- Atribución ---`);
    console.log(`Humanos (attributeToUser): ${countHuman}`);
    console.log(`Automáticos (attributeToApp): ${countApp}`);
    console.log(`Sin atribución clara:      ${countNone}`);

    // Apps
    console.log(`\n--- Apps que generan eventos ---`);
    const sortedApps = Object.keys(apps).sort((a,b) => apps[b] - apps[a]);
    if (sortedApps.length === 0) {
      console.log("Ninguna detectada explícitamente.");
    } else {
      sortedApps.forEach(k => console.log(`${k.padEnd(30)} ${apps[k]}`));
    }

    // Temporal Distribution (Human)
    console.log(`\n--- Distribución temporal de eventos humanos (últimos 30 días) ---`);
    const sortedDays = Object.keys(eventsPerDayHuman).sort();
    if (sortedDays.length === 0) {
      console.log("No hay eventos humanos.");
    } else {
      sortedDays.forEach(d => console.log(`${d}: ${eventsPerDayHuman[d]}`));
    }

    // GID Analysis
    console.log(`\n--- Análisis de IDs de Eventos (GIDs con query params) ---`);
    if (gidParams.size === 0) {
      console.log("No se detectaron sufijos o query params especiales en los GIDs (ej. ?staff_member_id).");
    } else {
      console.log("Sufijos únicos encontrados:");
      gidParams.forEach(p => console.log(`  ${p}`));
    }

    // Sample Human Events
    console.log(`\n--- Muestra de eventos humanos (máx 20 aleatorios) ---`);
    if (humanEvents.length > 0) {
      const sampleSize = Math.min(20, humanEvents.length);
      const shuffled = humanEvents.sort(() => 0.5 - Math.random());
      const sample = shuffled.slice(0, sampleSize);
      
      console.table(sample.map(e => ({
        Timestamp: e.createdAt.replace('T', ' ').substring(0, 19),
        Action: e.action,
        Subject: e.subjectType || 'N/A',
        App: e.appTitle || 'N/A',
        Message: (e.message || '').substring(0, 100) + (e.message && e.message.length > 100 ? '...' : '')
      })));
    }

  } catch (error) {
    console.error("❌ Error inspeccionando eventos:", error.message);
  }
}

inspectEvents();
