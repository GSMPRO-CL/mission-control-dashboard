/**
 * sync-shopping-position.js
 * 
 * Pipeline de Market Intelligence — Fase 4: Posicionamiento Shopping
 * 
 * Flujo:
 *   1. Lee el Top 30 de productos más vendidos en pedidos pagados (últimos 30 días) desde BigQuery.
 *   2. Extrae la "keyword principal" de cada título.
 *   3. Consulta SerpApi (Google Shopping) por batches.
 *   4. Inserta el ranking orgánico/pagado en `raw_layer.shopping_position`.
 *
 * Uso:
 *   node scripts/sync-shopping-position.js
 *   node scripts/sync-shopping-position.js --dry-run
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');

// ─── Constantes ──────────────────────────────────────────────────────────────
const DATASET_ID   = 'raw_layer';
const TABLE_ID     = 'shopping_position';
const BATCH_SIZE   = 5;           // Keywords por llamada paralela a SerpApi
const BRAND_NAME   = 'GSMPRO';
const COUNTRY      = 'cl';        // Para gl=cl
const isDryRun     = process.argv.includes('--dry-run');

// ─── Utilidades ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function extractKeyword(title) {
  let kw = title
    .replace(/:\s.*/, '')
    .replace(/\b\d+\s*(GB|TB|MB|mAh|W|Hz|K|MP|mm)\b/gi, '')
    .replace(/\b(negro|blanco|rojo|azul|verde|gris|plata|dorado|morado|amarillo|naranja|beige|titanio|grafito|rosa|celeste|black|white|silver|gold|blue|red|green|purple)\b/gi, '')
    .replace(/\b(fly more combo|bundle|pack|kit|set|edición|edition|plus|ultra|pro max|mega|mini|lite|se|rs|nfc)\b(?=\s+\w)/gi, (m) => m)
    .replace(/\b(para|auto|coche|hogar|casa|escritorio|portatil|portátil|educativa|educativo|profesional|básico|avanzado|compacto|original)\b/gi, '')
    .replace(/[–—\-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const words = kw.split(' ').filter(Boolean);
  return words.slice(0, 5).join(' ');
}

// ─── BigQuery ─────────────────────────────────────────────────────────────────
async function fetchTopProducts(bq) {
  const projectId = process.env.GCP_PROJECT_ID;
  const query = `
    SELECT 
      CAST(line.product_id AS INT64) as product_id, 
      line.title, 
      SUM(CAST(line.quantity AS INT64)) as total_sold
    FROM \`${projectId}.ecommerce_data.shopify_orders\` o
    JOIN \`${projectId}.ecommerce_data.shopify_order_lines\` line ON o.id = line.order_id
    WHERE o.financial_status IN ('paid', 'partially_paid')
      AND o.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      AND line.product_id IS NOT NULL
    GROUP BY line.product_id, line.title
    ORDER BY total_sold DESC
    LIMIT 30
  `;
  const [rows] = await bq.query({ query });
  return rows;
}

async function insertPositions(bq, records) {
  if (records.length === 0) return;
  const projectId = process.env.GCP_PROJECT_ID;
  const target = `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;
  
  const valueClauses = records.map(r => `(
    ${JSON.stringify(r.keyword)},
    ${r.product_id},
    CURRENT_DATE(),
    EXTRACT(HOUR FROM CURRENT_TIMESTAMP()),
    ${r.organic_position !== null ? r.organic_position : 'NULL'},
    ${r.paid_position !== null ? r.paid_position : 'NULL'},
    ${r.top_competitor_name ? JSON.stringify(r.top_competitor_name) : 'NULL'},
    ${r.top_competitor_price !== null ? r.top_competitor_price : 'NULL'},
    CURRENT_TIMESTAMP()
  )`).join(',\n');

  const query = `
    INSERT INTO ${target} (
      keyword, product_id, scan_date, scan_hour, organic_position, paid_position, top_competitor_name, top_competitor_price, scraped_at
    )
    VALUES
    ${valueClauses}
  `;

  const [job] = await bq.createQueryJob({ query });
  await job.promise();
}

// ─── SerpApi ──────────────────────────────────────────────────────────────────
async function fetchSerpApiPositions(keyword) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error('SERPAPI_KEY no configurada en .env');

  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine',  'google_shopping');
  url.searchParams.set('q',       keyword);
  url.searchParams.set('gl',      COUNTRY);
  url.searchParams.set('hl',      'es');
  url.searchParams.set('num',     '40');
  url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error) {
    throw new Error(`SerpApi Error: ${json.error}`);
  }

  const brandLower = BRAND_NAME.toLowerCase();
  const organic = json.shopping_results ?? [];
  const paid    = json.ads_results ?? [];

  const findBrand = (results) =>
    results.findIndex(r => (r.source ?? '').toLowerCase().includes(brandLower));

  const organicPos = findBrand(organic);
  const paidPos    = findBrand(paid);

  let topCompName = null;
  let topCompPrice = null;

  // Extraer top competidor (el primero que no seamos nosotros)
  const firstCompetitor = organic.find(r => !(r.source ?? '').toLowerCase().includes(brandLower));
  if (firstCompetitor) {
    topCompName = firstCompetitor.source;
    // Intentar extraer el número del precio
    const priceStr = firstCompetitor.price;
    if (priceStr) {
      const match = priceStr.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
      topCompPrice = parseFloat(match);
      if (isNaN(topCompPrice)) topCompPrice = null;
    }
  }

  return {
    organic_position: organicPos >= 0 ? organicPos + 1 : null,
    paid_position:    paidPos >= 0 ? paidPos + 1 : null,
    top_competitor_name: topCompName,
    top_competitor_price: topCompPrice
  };
}

// ─── Función Principal ────────────────────────────────────────────────────────
async function runSync() {
  console.log('=== INICIANDO SINCRONIZACIÓN: Shopping Position ===');
  if (isDryRun) console.log('⚡ MODO DRY-RUN: No se escribirá en BigQuery ni se gastarán muchos créditos (simulado)\n');

  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

  // 1. Obtener Top 30 productos
  console.log('[1/4] Obteniendo Top 30 productos desde pedidos pagados...');
  const products = await fetchTopProducts(bq);
  console.log(`  → ${products.length} productos obtenidos.`);

  if (products.length === 0) {
    console.log('  → No hay productos para procesar. Fin.');
    return;
  }

  // 2. Extraer y deduplicar keywords
  console.log('\n[2/4] Procesando keywords...');
  const items = products.map(p => ({
    ...p,
    keyword: extractKeyword(p.title)
  }));
  
  // Agrupar por keyword para evitar peticiones duplicadas a SerpApi
  const keywordMap = new Map();
  for (const item of items) {
    if (!keywordMap.has(item.keyword)) {
      keywordMap.set(item.keyword, []);
    }
    keywordMap.get(item.keyword).push(item.product_id);
  }
  
  const uniqueKeywords = Array.from(keywordMap.keys());
  console.log(`  → ${uniqueKeywords.length} keywords únicas a consultar.`);

  // 3. Consultar SerpApi
  console.log(`\n[3/4] Consultando SerpApi (batches de ${BATCH_SIZE})...`);
  const results = new Map();

  for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
    const batch = uniqueKeywords.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  → Procesando batch ${Math.ceil((i+1)/BATCH_SIZE)}/${Math.ceil(uniqueKeywords.length/BATCH_SIZE)}...`);
    
    if (isDryRun) {
      // Mock para dry-run
      for (const kw of batch) {
        results.set(kw, {
          organic_position: Math.floor(Math.random() * 20) + 1,
          paid_position: Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : null,
          top_competitor_name: 'Competidor Dummy',
          top_competitor_price: 199990
        });
      }
      await sleep(500);
    } else {
      const promises = batch.map(async (kw) => {
        try {
          const res = await fetchSerpApiPositions(kw);
          return { kw, res };
        } catch (err) {
          console.warn(`\n  ⚠️ Error en SerpApi para "${kw}": ${err.message}`);
          return { kw, res: null };
        }
      });
      
      const batchRes = await Promise.all(promises);
      for (const { kw, res } of batchRes) {
        if (res) results.set(kw, res);
      }
      await sleep(1000); // Rate limiting
    }
  }

  // 4. Preparar registros y subir a BQ
  console.log('\n\n[4/4] Guardando resultados en BigQuery...');
  const recordsToInsert = [];
  
  for (const item of items) {
    const pos = results.get(item.keyword);
    if (pos) {
      recordsToInsert.push({
        keyword: item.keyword,
        product_id: item.product_id,
        ...pos
      });
    }
  }

  if (isDryRun) {
    console.log('\n📋 Muestra de registros a insertar (dry-run):');
    console.log(JSON.stringify(recordsToInsert.slice(0, 3), null, 2));
    console.log(`\n✅ Dry-run completado. ${recordsToInsert.length} registros listos para insertar.`);
    return;
  }

  await insertPositions(bq, recordsToInsert);
  console.log(`\n✅ Sincronización completada. ${recordsToInsert.length} registros insertados en raw_layer.shopping_position.`);
}

runSync().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
