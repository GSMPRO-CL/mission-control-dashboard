/**
 * sync-competitor-prices.js
 *
 * Pipeline de Market Intelligence — Fase 2: Competitividad
 *
 * Arquitectura: Patrón Strategy (Multi-Proveedor)
 * ─────────────────────────────────────────────────
 * Para añadir un nuevo proveedor de precios en el futuro:
 *   1. Crear una clase que extienda `PriceProvider` en la sección "PROVIDERS"
 *   2. Registrarla en `PROVIDER_REGISTRY`
 *   3. Sin tocar ningún otro archivo ni la tabla de BigQuery
 *
 * Uso:
 *   node scripts/sync-competitor-prices.js
 *   node scripts/sync-competitor-prices.js --dry-run      (sin escribir a BigQuery)
 *   node scripts/sync-competitor-prices.js --limit 10     (solo primeros 10 productos)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { randomUUID } = require('crypto');

// ─── Constantes ───────────────────────────────────────────────────────────────
const DATASET_ID     = 'ecommerce_data';
const TABLE_ID       = 'competitor_prices';
const SLEEP_MS       = 1500;       // Pausa entre llamadas a la API (anti rate-limit)
const MAX_COMPETITORS = 5;         // Máx competidores por producto a almacenar
const isDryRun       = process.argv.includes('--dry-run');
const limitArg       = process.argv.find(a => a.startsWith('--limit='));
const PRODUCT_LIMIT  = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Interfaz Base: PriceProvider ─────────────────────────────────────────────
/**
 * Clase base que define el contrato para cualquier proveedor de precios.
 * Todo nuevo proveedor debe extender esta clase e implementar `fetchCompetitors`.
 */
class PriceProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {string} keyword - Término de búsqueda del producto
   * @param {string} countryCode - Código de país ISO (ej: 'cl')
   * @returns {Promise<Array<{title, price, source, has_stock, url, thumbnail}>>}
   */
  async fetchCompetitors(keyword, countryCode) {
    throw new Error(`Provider "${this.name}" must implement fetchCompetitors()`);
  }
}

// ─── PROVIDERS ────────────────────────────────────────────────────────────────

/**
 * Proveedor: SerpApi Google Shopping
 * Documentación: https://serpapi.com/google-shopping-api
 */
class SerpApiShoppingProvider extends PriceProvider {
  constructor(apiKey) {
    super('serpapi_shopping');
    this.apiKey = apiKey;
  }

  async fetchCompetitors(keyword, countryCode = 'cl') {
    const params = new URLSearchParams({
      engine:  'google_shopping',
      q:       keyword,
      gl:      countryCode,
      hl:      'es',
      num:     String(MAX_COMPETITORS + 2), // Pedir un poco más para filtrar irrelevantes
      api_key: this.apiKey,
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SerpApi HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(`SerpApi API Error: ${data.error}`);
    }

    const results = data.shopping_results || [];

    return results.slice(0, MAX_COMPETITORS).map(item => {
      // Limpiar precio: "$129.990" → 129990
      const rawPrice = item.price || item.extracted_price || '0';
      const cleanPrice = typeof rawPrice === 'number'
        ? rawPrice
        : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

      // Detectar stock: SerpApi marca "Agotado" o tiene tag out_of_stock
      const outOfStockSignals = ['agotado', 'out of stock', 'sin stock', 'no disponible'];
      const tags = [item.tag, item.badge, item.second_hand_condition]
        .filter(Boolean).join(' ').toLowerCase();
      const hasStock = !outOfStockSignals.some(s => tags.includes(s));

      return {
        title:     item.title     || '',
        price:     cleanPrice,
        source:    item.source    || item.store || '',
        has_stock: hasStock,
        url:       item.link      || item.product_link || '',
        thumbnail: item.thumbnail || '',
      };
    }).filter(c => c.price > 0 && c.source); // Solo competidores con precio y tienda válidos
  }
}

// ─── Registry de Proveedores ─────────────────────────────────────────────────
const PROVIDER_REGISTRY = {
  serpapi_shopping: () => {
    const key = process.env.SERPAPI_KEY;
    if (!key) throw new Error('SERPAPI_KEY no definida en variables de entorno');
    return new SerpApiShoppingProvider(key);
  },
  // Para añadir un nuevo proveedor en el futuro:
  // mi_nuevo_proveedor: () => new MiNuevoProvider(process.env.MI_KEY),
};

function buildProvider(providerName = 'serpapi_shopping') {
  const factory = PROVIDER_REGISTRY[providerName];
  if (!factory) throw new Error(`Proveedor desconocido: "${providerName}". Registra uno en PROVIDER_REGISTRY.`);
  return factory();
}

// ─── BigQuery ─────────────────────────────────────────────────────────────────
async function fetchActiveProducts(bq) {
  const projectId = process.env.GCP_PROJECT_ID;
  const query = `
    SELECT
      p.id   AS product_id,
      p.title,
      p.vendor,
      ROUND(AVG(v.price), 2) AS avg_price
    FROM \`${projectId}.${DATASET_ID}.shopify_products\` p
    JOIN \`${projectId}.${DATASET_ID}.shopify_product_variants\` v ON v.product_id = p.id
    WHERE p.status = 'active'
      AND v.price > 0
    GROUP BY p.id, p.title, p.vendor
    HAVING avg_price > 0
    ORDER BY avg_price DESC
  `;
  const [rows] = await bq.query({ query });
  return rows;
}

async function upsertCompetitors(bq, records) {
  if (records.length === 0) return;
  const projectId = process.env.GCP_PROJECT_ID;
  const target = `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;

  // Para el monitor de precios usamos INSERT en lugar de MERGE
  // ya que queremos mantener historial temporal (tabla particionada por fecha)
  // y cada sync agrega una "fotografía" nueva del mercado.
  const [job] = await bq.createQueryJob({
    query: `INSERT INTO ${target} (
      record_id, product_id, product_title, vendor, keyword_searched,
      our_price, competitor_name, competitor_title, competitor_price,
      has_stock, competitor_url, thumbnail_url,
      price_diff_amount, price_diff_pct, is_competitive,
      data_source, synced_at
    ) VALUES ${records.map(r => `(
      '${r.record_id}', ${r.product_id}, ${JSON.stringify(r.product_title)},
      ${r.vendor ? JSON.stringify(r.vendor) : 'NULL'},
      ${JSON.stringify(r.keyword_searched)},
      ${r.our_price}, ${JSON.stringify(r.competitor_name)},
      ${JSON.stringify(r.competitor_title)}, ${r.competitor_price},
      ${r.has_stock}, ${r.competitor_url ? JSON.stringify(r.competitor_url) : 'NULL'},
      ${r.thumbnail_url ? JSON.stringify(r.thumbnail_url) : 'NULL'},
      ${r.price_diff_amount}, ${r.price_diff_pct}, ${r.is_competitive},
      ${JSON.stringify(r.data_source)},
      TIMESTAMP '${r.synced_at}'
    )`).join(',\n')}`,
  });
  await job.promise();
}

// ─── Extracción de keyword de búsqueda ───────────────────────────────────────
// Reutilizamos la misma lógica de extracción de keyword de Phase 1
function extractSearchKeyword(title) {
  let kw = title
    .replace(/:\s.*/, '')
    .replace(/\b\d+\s*(GB|TB|MB|mAh|W|Hz|K|MP|mm)\b/gi, '')
    .replace(/\b(negro|blanco|rojo|azul|verde|gris|plata|dorado|morado|amarillo|naranja|beige|titanio|grafito|rosa|celeste|black|white|silver|gold|blue|red|green|purple)\b/gi, '')
    .replace(/\b(para|auto|coche|hogar|casa|escritorio|educativa|educativo|profesional|básico|avanzado|compacto|original)\b/gi, '')
    .replace(/[–—\-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return kw.split(' ').filter(Boolean).slice(0, 5).join(' ');
}

// ─── Función Principal ────────────────────────────────────────────────────────
async function runSync() {
  console.log('=== INICIANDO SINCRONIZACIÓN: Monitor de Precios Competidores ===');
  if (isDryRun) console.log('⚡ MODO DRY-RUN: No se escribirá en BigQuery\n');

  const bq       = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const provider = buildProvider('serpapi_shopping');
  const now      = new Date().toISOString();

  // 1. Productos activos
  console.log('\n[1/3] Obteniendo productos activos desde BigQuery...');
  let products = await fetchActiveProducts(bq);
  if (PRODUCT_LIMIT) products = products.slice(0, PRODUCT_LIMIT);
  console.log(`  → ${products.length} productos a monitorear.`);

  // 2. Consultar competidores por producto
  console.log(`\n[2/3] Consultando precios de competidores via ${provider.name}...`);
  const allRecords = [];
  let processed = 0, errors = 0;

  for (const product of products) {
    const keyword = extractSearchKeyword(product.title);
    process.stdout.write(`\r  → [${processed + 1}/${products.length}] "${keyword.slice(0,40)}"...`);

    try {
      const competitors = await provider.fetchCompetitors(keyword, 'cl');

      for (const comp of competitors) {
        const diffAmount = Math.round((product.avg_price - comp.price) * 100) / 100;
        const diffPct    = comp.price > 0
          ? Math.round(((product.avg_price - comp.price) / comp.price) * 10000) / 100
          : 0;

        allRecords.push({
          record_id:        randomUUID(),
          product_id:       Number(product.product_id),
          product_title:    product.title,
          vendor:           product.vendor || null,
          keyword_searched: keyword,
          our_price:        product.avg_price,
          competitor_name:  comp.source,
          competitor_title: comp.title,
          competitor_price: comp.price,
          has_stock:        comp.has_stock,
          competitor_url:   comp.url || null,
          thumbnail_url:    comp.thumbnail || null,
          price_diff_amount: diffAmount,
          price_diff_pct:    diffPct,
          is_competitive:    diffAmount <= 0, // Somos competitivos si nuestro precio ≤ competidor
          data_source:      provider.name,
          synced_at:        now,
        });
      }
    } catch (err) {
      errors++;
      console.log(`\n  ⚠️  Error en "${keyword.slice(0,30)}": ${err.message.slice(0, 100)}`);
    }

    processed++;
    await sleep(SLEEP_MS);
  }

  console.log(`\n  → ${allRecords.length} registros de competidores encontrados. Errores: ${errors}`);

  if (isDryRun) {
    console.log('\n📋 Muestra (dry-run):');
    console.log(JSON.stringify(allRecords.slice(0, 3), null, 2));
    console.log(`\n✅ Dry-run completado. ${allRecords.length} registros listos.`);
    return;
  }

  // 3. Insertar en BigQuery en batches de 50
  console.log('\n[3/3] Insertando en BigQuery...');
  const BATCH = 50;
  for (let i = 0; i < allRecords.length; i += BATCH) {
    await upsertCompetitors(bq, allRecords.slice(i, i + BATCH));
    process.stdout.write(`\r  → ${Math.min(i + BATCH, allRecords.length)}/${allRecords.length} insertados...`);
  }
  console.log(`\n\n✅ Sincronización completada. ${allRecords.length} registros de competidores guardados.`);
}

runSync().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
