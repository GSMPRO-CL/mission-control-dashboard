/**
 * sync-market-trends.js
 *
 * Pipeline de Market Intelligence — Fase 3: Tendencias
 *
 * Flujo:
 *   1. Lee las marcas top desde BigQuery (shopify_products).
 *   2. Consulta el proveedor de Google Trends para cada marca.
 *   3. Calcula señales automáticas (Breakout, Rising, Stable, Falling, Risk).
 *   4. Inserta en `ecommerce_data.market_trends` (tabla histórica particionada).
 *
 * Arquitectura: Patrón Strategy (Multi-Proveedor)
 * ─────────────────────────────────────────────────
 * Para añadir un nuevo proveedor en el futuro:
 *   1. Crear una clase que extienda `TrendsProvider`
 *   2. Registrarla en `PROVIDER_REGISTRY`
 *   3. Sin modificar el resto del pipeline ni la tabla BigQuery
 *
 * Uso:
 *   node scripts/sync-market-trends.js
 *   node scripts/sync-market-trends.js --dry-run
 *   node scripts/sync-market-trends.js --top=10   (solo top 10 marcas por volumen)
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const { randomUUID } = require('crypto');

// ─── Constantes ───────────────────────────────────────────────────────────────
const DATASET_ID  = 'ecommerce_data';
const TABLE_ID    = 'market_trends';
const GEO         = 'CL';
const TREND_RANGE = 'today 12-m';   // Ventana de análisis: último año
const SLEEP_MS    = 2000;           // Anti-rate-limit
const isDryRun    = process.argv.includes('--dry-run');
const topArg      = process.argv.find(a => a.startsWith('--top='));
const TOP_BRANDS  = topArg ? parseInt(topArg.split('=')[1]) : 30;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Interfaz Base: TrendsProvider ────────────────────────────────────────────
/**
 * Contrato que deben cumplir todos los proveedores de tendencias.
 * Garantiza que el pipeline sea completamente agnóstico al proveedor.
 */
class TrendsProvider {
  constructor(name) { this.name = name; }

  /**
   * @param {string} keyword - Término a analizar (ej: "Apple")
   * @param {string} geo     - Código de país ISO-2 (ej: "CL")
   * @param {string} range   - Rango de tiempo (ej: "today 12-m")
   * @returns {Promise<Array<{ date: string, value: number, isPartial: boolean }>>}
   */
  async fetchTrend(keyword, geo, range) {
    throw new Error(`Provider "${this.name}" must implement fetchTrend()`);
  }
}

// ─── PROVIDERS ────────────────────────────────────────────────────────────────

/**
 * Proveedor: SerpApi Google Trends
 * Documentación: https://serpapi.com/google-trends-api
 * Créditos: Comparte el plan con los demás motores de SerpApi
 */
class SerpApiTrendsProvider extends TrendsProvider {
  constructor(apiKey) {
    super('serpapi_trends');
    this.apiKey = apiKey;
  }

  async fetchTrend(keyword, geo, range) {
    const params = new URLSearchParams({
      engine:  'google_trends',
      q:       keyword,
      geo,
      date:    range,
      tz:      '-240',  // UTC-4 (Chile Standard Time)
      api_key: this.apiKey,
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);

    const data = await res.json();
    if (data.error) throw new Error(`SerpApi: ${data.error}`);

    const timeline = data.interest_over_time?.timeline_data || [];
    return timeline.map(point => {
      let parsedDate = '';
      if (point.date) {
        const match = point.date.match(/^([A-Za-z]+ \d+).*?, (\d{4})/);
        if (match) {
          const d = new Date(`${match[1]} ${match[2]}`);
          if (!isNaN(d)) parsedDate = d.toISOString().split('T')[0];
        } else {
          const d2 = new Date(point.date);
          if (!isNaN(d2)) parsedDate = d2.toISOString().split('T')[0];
        }
      }
      return {
        date:      parsedDate,
        value:     point.values?.[0]?.extracted_value ?? 0,
        isPartial: point.is_partial ?? false,
      };
    }).filter(p => p.date);
  }
}

/**
 * Proveedor: DataForSEO Google Trends
 * Alternativa independiente de SerpApi.
 * Documentación: https://docs.dataforseo.com/v3/keywords_data/google_trends/
 * Para activar: agregar DATAFORSEO_LOGIN y DATAFORSEO_PASSWORD a .env y env.yaml
 */
class DataForSEOTrendsProvider extends TrendsProvider {
  constructor(login, password) {
    super('dataforseo_trends');
    this.credentials = Buffer.from(`${login}:${password}`).toString('base64');
  }

  async fetchTrend(keyword, geo, range) {
    const res = await fetch('https://api.dataforseo.com/v3/keywords_data/google_trends/explore/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{
        keywords: [keyword],
        location_code: 2152, // Chile
        language_code: 'es',
        time_range: 'past_12_months',
        type: 'web',
      }]),
    });

    const data = await res.json();
    const items = data.tasks?.[0]?.result?.[0]?.items || [];
    const timelineItem = items.find(i => i.type === 'google_trends_graph');

    return (timelineItem?.data || []).map(point => ({
      date:      point.date_from?.split('T')[0] ?? '',
      value:     point.values?.[0] ?? 0,
      isPartial: false,
    })).filter(p => p.date);
  }
}

// ─── Registry de Proveedores ─────────────────────────────────────────────────
const PROVIDER_REGISTRY = {
  serpapi_trends: () => {
    const key = process.env.SERPAPI_KEY;
    if (!key) throw new Error('SERPAPI_KEY no definida en variables de entorno');
    return new SerpApiTrendsProvider(key);
  },
  dataforseo_trends: () => {
    const login    = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error('DATAFORSEO_LOGIN/PASSWORD no definidos');
    return new DataForSEOTrendsProvider(login, password);
  },
};

function buildProvider(name = 'serpapi_trends') {
  const factory = PROVIDER_REGISTRY[name];
  if (!factory) throw new Error(`Proveedor desconocido: "${name}"`);
  return factory();
}

// ─── Algoritmo de Señales ─────────────────────────────────────────────────────
/**
 * Analiza una serie temporal de 0-100 y devuelve una señal de negocio.
 *
 * Lógica:
 *  - breakout : Último valor >= 90 y crecimiento reciente > 50%
 *  - rising   : Pendiente positiva consistente en últimas 4 semanas
 *  - falling  : Pendiente negativa consistente en últimas 4 semanas
 *  - risk     : Últimas 4 semanas con valor promedio < 15 (muy baja demanda)
 *  - stable   : Todo lo demás
 */
function calculateSignal(timeline) {
  if (!timeline || timeline.length < 4) {
    return { signal: 'stable', detail: 'Datos insuficientes para calcular señal.' };
  }

  const values = timeline.map(t => t.value);
  const lastVal = values[values.length - 1];
  const recent4 = values.slice(-4);
  const prev4   = values.slice(-8, -4);

  const recentAvg = recent4.reduce((s, v) => s + v, 0) / recent4.length;
  const prevAvg   = prev4.length > 0 ? prev4.reduce((s, v) => s + v, 0) / prev4.length : recentAvg;

  const growthRate = prevAvg > 0 ? ((recentAvg - prevAvg) / prevAvg) * 100 : 0;
  const isRising   = recent4.every((v, i) => i === 0 || v >= recent4[i - 1] * 0.9);
  const isFalling  = recent4.every((v, i) => i === 0 || v <= recent4[i - 1] * 1.1);

  if (lastVal >= 90 && growthRate > 50) {
    return { signal: 'breakout', detail: `Demanda explosiva: índice ${lastVal}/100. Considera restock urgente o campaña de Ads.` };
  }
  if (recentAvg < 15) {
    return { signal: 'risk', detail: `Demanda muy baja (${recentAvg.toFixed(0)}/100 promedio). Riesgo de inventario muerto.` };
  }
  if (growthRate > 20 && isRising) {
    return { signal: 'rising', detail: `Tendencia al alza: +${growthRate.toFixed(0)}% en últimas 4 semanas.` };
  }
  if (growthRate < -20 && isFalling) {
    return { signal: 'falling', detail: `Tendencia a la baja: ${growthRate.toFixed(0)}% en últimas 4 semanas.` };
  }
  return { signal: 'stable', detail: `Demanda estable. Índice promedio: ${recentAvg.toFixed(0)}/100.` };
}

// ─── BigQuery ─────────────────────────────────────────────────────────────────
async function fetchTopBrands(bq) {
  const projectId = process.env.GCP_PROJECT_ID;
  const [rows] = await bq.query({
    query: `
      SELECT
        p.vendor AS keyword,
        COUNT(DISTINCT p.id) AS vendor_products,
        ROUND(AVG(v.inventory_quantity), 0) AS avg_stock
      FROM \`${projectId}.${DATASET_ID}.shopify_products\` p
      JOIN \`${projectId}.${DATASET_ID}.shopify_product_variants\` v ON v.product_id = p.id
      WHERE p.status = 'active'
        AND p.vendor IS NOT NULL
        AND p.vendor NOT IN ('GSMPRO.CL', '')  -- Excluir marca propia
      GROUP BY p.vendor
      HAVING vendor_products >= 3
      ORDER BY vendor_products DESC
      LIMIT @top
    `,
    params: { top: TOP_BRANDS },
  });
  return rows;
}

async function insertTrends(bq, records) {
  if (records.length === 0) return;
  const projectId = process.env.GCP_PROJECT_ID;
  const target = `\`${projectId}.${DATASET_ID}.${TABLE_ID}\``;

  // INSERT histórico: cada sync agrega una nueva snapshot sin borrar el historial
  const [job] = await bq.createQueryJob({
    query: `
      INSERT INTO ${target} (
        record_id, keyword, keyword_type, geo,
        trend_date, interest_value, is_partial,
        signal, signal_detail,
        vendor_products, avg_stock,
        data_source, synced_at
      ) VALUES ${records.map(r => `(
        '${r.record_id}', ${JSON.stringify(r.keyword)}, ${JSON.stringify(r.keyword_type)}, '${r.geo}',
        DATE '${r.trend_date}', ${r.interest_value}, ${r.is_partial},
        ${JSON.stringify(r.signal)}, ${JSON.stringify(r.signal_detail)},
        ${r.vendor_products ?? 0}, ${r.avg_stock ?? 0},
        ${JSON.stringify(r.data_source)},
        TIMESTAMP '${r.synced_at}'
      )`).join(',\n')}
    `,
  });
  await job.promise();
}

// ─── Función Principal ────────────────────────────────────────────────────────
async function runSync() {
  console.log('=== INICIANDO SINCRONIZACIÓN: Market Trends ===');
  if (isDryRun) console.log('⚡ MODO DRY-RUN: No se escribirá en BigQuery\n');

  const bq       = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
  const provider = buildProvider('serpapi_trends');
  const now      = new Date().toISOString();
  const allRecords = [];

  // 1. Top marcas
  console.log(`\n[1/3] Obteniendo top ${TOP_BRANDS} marcas desde BigQuery...`);
  const brands = await fetchTopBrands(bq);
  console.log(`  → ${brands.length} marcas a analizar.`);

  // 2. Consultar tendencias
  console.log(`\n[2/3] Consultando Google Trends via ${provider.name}...`);
  let processed = 0, errors = 0;

  for (const brand of brands) {
    process.stdout.write(`\r  → [${processed + 1}/${brands.length}] "${brand.keyword}"...`);

    try {
      const timeline = await provider.fetchTrend(brand.keyword, GEO, TREND_RANGE);
      const { signal, detail } = calculateSignal(timeline);

      for (const point of timeline) {
        allRecords.push({
          record_id:    randomUUID(),
          keyword:      brand.keyword,
          keyword_type: 'brand',
          geo:          GEO,
          trend_date:   point.date,
          interest_value: point.value,
          is_partial:   point.isPartial,
          signal,
          signal_detail: detail,
          vendor_products: Number(brand.vendor_products),
          avg_stock:    Number(brand.avg_stock),
          data_source:  provider.name,
          synced_at:    now,
        });
      }
    } catch (err) {
      errors++;
      console.log(`\n  ⚠️  Error en "${brand.keyword}": ${err.message.slice(0, 100)}`);
    }

    processed++;
    await sleep(SLEEP_MS);
  }

  console.log(`\n  → ${allRecords.length} puntos de datos generados. Errores: ${errors}`);

  if (isDryRun) {
    console.log('\n📋 Muestra (dry-run):');
    console.log(JSON.stringify(allRecords.slice(0, 4), null, 2));
    console.log(`\n✅ Dry-run completado. ${allRecords.length} registros listos.`);
    return;
  }

  // 3. INSERT en BigQuery en batches de 200
  console.log('\n[3/3] Insertando en BigQuery...');
  const BATCH = 200;
  for (let i = 0; i < allRecords.length; i += BATCH) {
    await insertTrends(bq, allRecords.slice(i, i + BATCH));
    process.stdout.write(`\r  → ${Math.min(i + BATCH, allRecords.length)}/${allRecords.length}...`);
  }
  console.log(`\n\n✅ Sync completado. ${allRecords.length} puntos de tendencia guardados.`);
}

runSync().catch(err => {
  console.error('\n❌ Error fatal:', err);
  process.exit(1);
});
