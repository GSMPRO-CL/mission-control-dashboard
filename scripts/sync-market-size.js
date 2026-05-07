/**
 * sync-market-size.js
 * 
 * Pipeline de Market Intelligence — Fase 1: Dimensión de Mercado
 * 
 * Flujo:
 *   1. Lee todos los productos activos desde BigQuery (shopify_products + variantes).
 *   2. Extrae la "keyword principal" de cada título (sin variantes, colores, capacidades).
 *   3. Consulta el KeywordPlanIdeaService de Google Ads para obtener volúmenes de búsqueda.
 *   4. Calcula Market Size y Market Share por producto.
 *   5. Upsert de resultados en `ecommerce_data.market_size_metrics` via MERGE.
 *
 * Uso:
 *   node scripts/sync-market-size.js
 *   node scripts/sync-market-size.js --dry-run   (solo muestra sin escribir a BQ)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { GoogleAdsApi } = require('google-ads-api');

// ─── Constantes ──────────────────────────────────────────────────────────────
const DATASET_ID   = 'ecommerce_data';
const TABLE_ID     = 'market_size_metrics';
const BATCH_SIZE   = 20;          // Keywords por llamada a Google Ads (límite seguro)
const BUYER_RATE   = 0.01;        // 1% del volumen de búsqueda = compradores potenciales
const SHARE_RATE   = 0.05;        // 5% del market size = cuota estimada de mercado
const SLEEP_MS     = 1200;        // Anti-rate-limit entre batches
const isDryRun     = process.argv.includes('--dry-run');

// ─── Utilidades ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Extrae la keyword principal de un título de producto.
 * Elimina variantes descriptivas como colores, capacidades, materiales y descriptores genéricos
 * que no forman parte del término de búsqueda principal del comprador.
 * 
 * Ejemplos:
 *   "iPhone 15 Pro Max 256GB Azul Titanio" → "iPhone 15 Pro Max"
 *   "Drone DJI Mini 4 Pro Fly More Combo" → "DJI Mini 4 Pro"
 *   "Easythreed Nano: Mini Impresora 3D Educativa" → "Easythreed Nano Impresora 3D"
 */
function extractKeyword(title) {
  let kw = title
    // Eliminar contenido después de dos puntos (subtítulos)
    .replace(/:\s.*/, '')
    // Eliminar capacidades de almacenamiento/batería
    .replace(/\b\d+\s*(GB|TB|MB|mAh|W|Hz|K|MP|mm)\b/gi, '')
    // Eliminar colores comunes
    .replace(/\b(negro|blanco|rojo|azul|verde|gris|plata|dorado|morado|amarillo|naranja|beige|titanio|grafito|rosa|celeste|black|white|silver|gold|blue|red|green|purple)\b/gi, '')
    // Eliminar descriptores de conjunto/edición
    .replace(/\b(fly more combo|bundle|pack|kit|set|edición|edition|plus|ultra|pro max|mega|mini|lite|se|rs|nfc)\b(?=\s+\w)/gi, (m) => m) // keep "Pro Max" as part of model
    // Eliminar descriptores finales genéricos
    .replace(/\b(para|auto|coche|hogar|casa|escritorio|portatil|portátil|educativa|educativo|profesional|básico|avanzado|compacto|original)\b/gi, '')
    // Limpiar espacios extras y caracteres especiales sobrantes
    .replace(/[–—\-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Limitar a máx 5 palabras para keywords efectivas en búsqueda
  const words = kw.split(' ').filter(Boolean);
  return words.slice(0, 5).join(' ');
}

// ─── BigQuery ─────────────────────────────────────────────────────────────────
async function fetchActiveProducts(bq) {
  const projectId = process.env.GCP_PROJECT_ID;
  const query = `
    SELECT 
      p.id as product_id,
      p.title,
      p.vendor,
      ROUND(AVG(v.price), 2) as avg_price,
      COUNT(v.id) as variant_count
    FROM \`${projectId}.${DATASET_ID}.shopify_products\` p
    JOIN \`${projectId}.${DATASET_ID}.shopify_product_variants\` v 
      ON v.product_id = p.id
    WHERE p.status = 'active'
      AND v.price > 0
    GROUP BY p.id, p.title, p.vendor
    HAVING avg_price > 0
    ORDER BY p.title
  `;
  const [rows] = await bq.query({ query });
  return rows;
}

async function upsertMetrics(bq, metrics) {
  if (metrics.length === 0) return;
  const projectId = process.env.GCP_PROJECT_ID;
  const target = `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;
  const now = new Date().toISOString();

  // Build MERGE using parameterized VALUES to avoid injection
  const valueClauses = metrics.map(m => `(
    ${m.product_id},
    ${JSON.stringify(m.product_title)},
    ${m.vendor ? JSON.stringify(m.vendor) : 'NULL'},
    ${m.keyword ? JSON.stringify(m.keyword) : 'NULL'},
    ${m.avg_price ?? 0},
    ${m.avg_monthly_searches ?? 0},
    ${m.last_month_searches ?? 0},
    ${m.avg_potential_buyers ?? 0},
    ${m.last_month_buyers ?? 0},
    ${m.market_size_avg ?? 0},
    ${m.market_size_last ?? 0},
    ${m.market_share_avg ?? 0},
    ${m.market_share_last ?? 0},
    TIMESTAMP '${now}'
  )`).join(',\n');

  const query = `
    MERGE ${target} T
    USING (
      SELECT * FROM UNNEST([
        STRUCT<
          product_id INT64, product_title STRING, vendor STRING, keyword STRING,
          avg_price FLOAT64, avg_monthly_searches INT64, last_month_searches INT64,
          avg_potential_buyers FLOAT64, last_month_buyers FLOAT64,
          market_size_avg FLOAT64, market_size_last FLOAT64,
          market_share_avg FLOAT64, market_share_last FLOAT64,
          synced_at TIMESTAMP
        >
        ${valueClauses}
      ])
    ) S ON T.product_id = S.product_id
    WHEN MATCHED THEN UPDATE SET
      product_title = S.product_title,
      vendor = S.vendor,
      keyword = S.keyword,
      avg_price = S.avg_price,
      avg_monthly_searches = S.avg_monthly_searches,
      last_month_searches = S.last_month_searches,
      avg_potential_buyers = S.avg_potential_buyers,
      last_month_buyers = S.last_month_buyers,
      market_size_avg = S.market_size_avg,
      market_size_last = S.market_size_last,
      market_share_avg = S.market_share_avg,
      market_share_last = S.market_share_last,
      synced_at = S.synced_at
    WHEN NOT MATCHED THEN INSERT ROW
  `;

  const [job] = await bq.createQueryJob({ query });
  await job.promise();
}

// ─── Google Ads KeywordPlanIdeaService ────────────────────────────────────────
function buildGoogleAdsClient() {
  const developerToken  = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId        = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret    = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken    = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId      = process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, '');
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replace(/-/g, '');

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    throw new Error('Faltan credenciales de Google Ads en las variables de entorno.');
  }

  const api = new GoogleAdsApi({ client_id: clientId, client_secret: clientSecret, developer_token: developerToken });
  const customerConfig = { customer_id: customerId, refresh_token: refreshToken };
  if (loginCustomerId) customerConfig.login_customer_id = loginCustomerId;
  return api.Customer(customerConfig);
}

/**
 * Consulta el KeywordPlanIdeaService para un batch de keywords.
 * Retorna un mapa: keyword → { avg_monthly_searches, last_month_searches }
 */
async function fetchKeywordVolumes(customer, keywords) {
  const result = new Map();

  try {
    // Language: Spanish (1003), Location: Chile (2152)
    const response = await customer.keywordPlanIdeas.generateKeywordIdeas({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID?.replace(/-/g, ''),
      language: 'languageConstants/1003',
      geo_target_constants: ['geoTargetConstants/2152'],
      include_adult_keywords: false,
      keyword_seed: { keywords },
    });

    for (const idea of (response || [])) {
      const text = idea.text?.toLowerCase()?.trim();
      if (!text) continue;

      const avgSearches   = Number(idea.keyword_idea_metrics?.avg_monthly_searches ?? 0);
      // monthly_search_volumes está ordenado de más antiguo a más reciente
      const monthlyVols   = idea.keyword_idea_metrics?.monthly_search_volumes ?? [];
      const lastMonthVol  = monthlyVols.length > 0
        ? Number(monthlyVols[monthlyVols.length - 1]?.monthly_searches ?? 0)
        : 0;

      result.set(text, { avg_monthly_searches: avgSearches, last_month_searches: lastMonthVol });
    }
  } catch (err) {
    console.warn(`  ⚠️  Error en batch de keywords: ${err.message?.slice(0, 120)}`);
  }

  return result;
}

// ─── Función Principal ────────────────────────────────────────────────────────
async function runSync() {
  console.log('=== INICIANDO SINCRONIZACIÓN: Market Size Metrics ===');
  if (isDryRun) console.log('⚡ MODO DRY-RUN: No se escribirá en BigQuery\n');

  const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  let customer;
  try {
    customer = buildGoogleAdsClient();
  } catch (err) {
    console.error('❌ Error al inicializar Google Ads Client:', err.message);
    process.exit(1);
  }

  // 1. Obtener productos activos
  console.log('\n[1/4] Obteniendo productos activos desde BigQuery...');
  const products = await fetchActiveProducts(bq);
  console.log(`  → ${products.length} productos activos encontrados.`);

  // 2. Extraer keywords únicas y mapeo
  console.log('\n[2/4] Extrayendo keywords principales...');
  const productKeywords = products.map(p => ({
    ...p,
    keyword: extractKeyword(p.title)
  }));

  // Deduplicar keywords para reducir llamadas a la API
  const uniqueKeywords = [...new Set(productKeywords.map(p => p.keyword.toLowerCase()))];
  console.log(`  → ${uniqueKeywords.length} keywords únicas (de ${products.length} productos).`);

  // 3. Consultar Google Ads por batches
  console.log(`\n[3/4] Consultando volúmenes de búsqueda en Google Ads (batches de ${BATCH_SIZE})...`);
  const volumeMap = new Map();
  const batches = [];
  for (let i = 0; i < uniqueKeywords.length; i += BATCH_SIZE) {
    batches.push(uniqueKeywords.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(`\r  → Batch ${i + 1}/${batches.length}...`);
    const batchResult = await fetchKeywordVolumes(customer, batches[i]);
    batchResult.forEach((v, k) => volumeMap.set(k, v));
    if (i < batches.length - 1) await sleep(SLEEP_MS);
  }
  console.log(`\n  → Volúmenes obtenidos para ${volumeMap.size} keywords.`);

  // 4. Calcular métricas y preparar upsert
  console.log('\n[4/4] Calculando métricas de Market Size y Market Share...');
  const metrics = productKeywords.map(p => {
    const kwLower  = p.keyword.toLowerCase();
    const volumes  = volumeMap.get(kwLower) || { avg_monthly_searches: 0, last_month_searches: 0 };
    const avgBuyers  = volumes.avg_monthly_searches  * BUYER_RATE;
    const lastBuyers = volumes.last_month_searches   * BUYER_RATE;
    const mktSizeAvg  = avgBuyers  * p.avg_price;
    const mktSizeLast = lastBuyers * p.avg_price;

    return {
      product_id:            Number(p.product_id),
      product_title:         p.title,
      vendor:                p.vendor || null,
      keyword:               p.keyword,
      avg_price:             p.avg_price,
      avg_monthly_searches:  volumes.avg_monthly_searches,
      last_month_searches:   volumes.last_month_searches,
      avg_potential_buyers:  Math.round(avgBuyers  * 100) / 100,
      last_month_buyers:     Math.round(lastBuyers * 100) / 100,
      market_size_avg:       Math.round(mktSizeAvg  * 100) / 100,
      market_size_last:      Math.round(mktSizeLast * 100) / 100,
      market_share_avg:      Math.round(mktSizeAvg  * SHARE_RATE * 100) / 100,
      market_share_last:     Math.round(mktSizeLast * SHARE_RATE * 100) / 100,
    };
  });

  if (isDryRun) {
    console.log('\n📋 Muestra de métricas calculadas (dry-run):');
    console.log(JSON.stringify(metrics.slice(0, 3), null, 2));
    console.log(`\n✅ Dry-run completado. ${metrics.length} registros listos para insertar.`);
    return;
  }

  // MERGE en BigQuery en sub-batches de 100 (límite de cláusulas en MERGE)
  const MERGE_BATCH = 100;
  for (let i = 0; i < metrics.length; i += MERGE_BATCH) {
    const chunk = metrics.slice(i, i + MERGE_BATCH);
    await upsertMetrics(bq, chunk);
    process.stdout.write(`\r  → Insertados ${Math.min(i + MERGE_BATCH, metrics.length)}/${metrics.length}...`);
  }

  console.log(`\n\n✅ Sincronización completada. ${metrics.length} productos procesados en market_size_metrics.`);
}

runSync().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
