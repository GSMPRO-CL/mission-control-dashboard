const { BigQuery } = require('@google-cloud/bigquery');
const { randomUUID } = require('crypto');

// ─── Constantes ───────────────────────────────────────────────────────────────
const DATASET_ID     = 'ecommerce_data';
const TABLE_ID       = 'competitor_prices';
const SLEEP_MS       = 1500;       // Pausa entre llamadas a la API (anti rate-limit)
const MAX_COMPETITORS = 5;         // Máx competidores por producto a almacenar

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Interfaz Base: PriceProvider ─────────────────────────────────────────────
class PriceProvider {
  constructor(name) {
    this.name = name;
  }
  async fetchCompetitors(keyword, countryCode) {
    throw new Error(`Provider "${this.name}" must implement fetchCompetitors()`);
  }
}

// ─── PROVIDERS ────────────────────────────────────────────────────────────────
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
      num:     String(MAX_COMPETITORS + 2), 
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
      const rawPrice = item.price || item.extracted_price || '0';
      const cleanPrice = typeof rawPrice === 'number'
        ? rawPrice
        : parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;

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
    }).filter(c => c.price > 0 && c.source);
  }
}

// ─── Registry de Proveedores ─────────────────────────────────────────────────
const PROVIDER_REGISTRY = {
  serpapi_shopping: () => {
    const key = process.env.SERPAPI_KEY;
    if (!key) throw new Error('SERPAPI_KEY no definida en variables de entorno');
    return new SerpApiShoppingProvider(key);
  },
};

function buildProvider(providerName = 'serpapi_shopping') {
  const factory = PROVIDER_REGISTRY[providerName];
  if (!factory) throw new Error(`Proveedor desconocido: "${providerName}".`);
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

// ─── Cloud Function Entry Point ────────────────────────────────────────────────
exports.syncCompetitorPrices = async (req, res) => {
  console.log('=== INICIANDO SINCRONIZACIÓN: Monitor de Precios Competidores (Cloud Function) ===');

  try {
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID no está definido en las variables de entorno.');
    }

    const bq       = new BigQuery({ projectId });
    const provider = buildProvider('serpapi_shopping');
    const now      = new Date().toISOString();

    console.log('[1/3] Obteniendo productos activos desde BigQuery...');
    const products = await fetchActiveProducts(bq);
    console.log(`-> ${products.length} productos a monitorear.`);

    console.log(`[2/3] Consultando precios de competidores via ${provider.name}...`);
    const allRecords = [];
    let processed = 0, errors = 0;

    for (const product of products) {
      const keyword = extractSearchKeyword(product.title);

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
            is_competitive:    diffAmount <= 0,
            data_source:      provider.name,
            synced_at:        now,
          });
        }
      } catch (err) {
        errors++;
        console.error(`Error en "${keyword}": ${err.message}`);
      }

      processed++;
      await sleep(SLEEP_MS);
    }

    console.log(`-> ${allRecords.length} registros encontrados. Errores: ${errors}`);

    console.log('[3/3] Insertando en BigQuery...');
    const BATCH = 50;
    for (let i = 0; i < allRecords.length; i += BATCH) {
      await upsertCompetitors(bq, allRecords.slice(i, i + BATCH));
      console.log(`-> ${Math.min(i + BATCH, allRecords.length)}/${allRecords.length} insertados...`);
    }

    console.log(`✅ Sincronización completada. ${allRecords.length} registros guardados.`);
    res.status(200).json({ success: true, records: allRecords.length, errors });
  } catch (err) {
    console.error('❌ Error fatal en Cloud Function:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
