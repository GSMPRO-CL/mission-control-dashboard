require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');

// Configuración
const APP_KEY = process.env.YOTPO_APP_KEY;
const SECRET_KEY = process.env.YOTPO_SECRET_KEY;
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const DATASET_ID = 'ecommerce_data';
const TABLE_ID = 'raw_yotpo_reviews';

async function getYotpoToken() {
  const res = await fetch(`https://api.yotpo.com/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: APP_KEY,
      client_secret: SECRET_KEY,
      grant_type: 'client_credentials'
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yotpo Auth Error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  const table = dataset.table(TABLE_ID);
  
  const [exists] = await table.exists();
  if (!exists) {
    console.log(`Creando tabla ${TABLE_ID} ya que no existe...`);
    const ddl = `
      CREATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\` (
          review_id INT64 NOT NULL,
          product_id STRING,
          score INT64,
          votes_up INT64,
          votes_down INT64,
          content STRING,
          title STRING,
          created_at TIMESTAMP,
          verified_buyer BOOLEAN,
          status STRING,
          _ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
      PARTITION BY DATE(created_at)
      OPTIONS(
          description="Tabla cruda con reseñas individuales extraídas de Yotpo",
          require_partition_filter=false
      );
    `;
    await bq.query(ddl);
    console.log(`✅ Tabla ${TABLE_ID} creada exitosamente.`);
  }

  return table;
}

async function fetchYotpoReviews(token, page = 1) {
  const res = await fetch(`https://api.yotpo.com/v1/apps/${APP_KEY}/reviews?utoken=${token}&page=${page}&count=100&deleted=true`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yotpo Fetch Error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data; // Return full data to debug
}

async function runSync() {
  console.log("=== INICIANDO EXTRACCIÓN YOTPO -> BIGQUERY ===");
  try {
    const token = await getYotpoToken();
    console.log("Token Yotpo obtenido exitosamente.");

    const bigquery = new BigQuery({ projectId: PROJECT_ID });
    const bqTable = await setupBigQuery(bigquery);

    let page = 1;
    let totalReviews = 0;
    let allRows = [];
    
    // Obtener la primera página para saber el total
    console.log(`Obteniendo reseñas (Página ${page})...`);
    let responseData = await fetchYotpoReviews(token, page);
    console.log("Raw Yotpo Response:", JSON.stringify(responseData).substring(0, 500));
    
    // Asumimos que data contiene los datos reales
    const yotpoResponse = responseData.response || responseData;

    if (!yotpoResponse || !yotpoResponse.reviews || yotpoResponse.reviews.length === 0) {
      console.log("No hay reseñas de Yotpo para procesar.");
      return;
    }
    
    while (true) {
      if (page > 1) {
        responseData = await fetchYotpoReviews(token, page);
      }
      
      const currentResponse = responseData.response || responseData;
      
      if (!currentResponse || !currentResponse.reviews || currentResponse.reviews.length === 0) {
        break; // No more reviews
      }
      
      const rows = currentResponse.reviews.map(rev => ({
        review_id: rev.id,
        product_id: String(rev.sku), // Yotpo mapea sku a su product ID
        score: rev.score,
        votes_up: rev.votes_up,
        votes_down: rev.votes_down,
        content: rev.content || '',
        title: rev.title || '',
        created_at: bigquery.timestamp(new Date(rev.created_at)),
        verified_buyer: rev.verified_buyer || false,
        status: rev.deleted ? 'pending' : 'published',
        _ingested_at: bigquery.timestamp(new Date())
      }));

      allRows = allRows.concat(rows);
      console.log(`[Página ${page}] Procesadas ${rows.length} reseñas.`);
      page++;
    }

    if (allRows.length > 0) {
      // Limpiamos la tabla para carga completa (si es requerimiento)
      // O podemos usar un modelo incremental. Para simplicidad de este pipeline, haremos TRUNCATE e INSERT
      console.log(`Limpiando tabla ${TABLE_ID} para carga full...`);
      await bigquery.query(`TRUNCATE TABLE \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\``);
      
      console.log(`Insertando ${allRows.length} reseñas en BigQuery...`);
      
      const chunkSize = 500;
      for (let i = 0; i < allRows.length; i += chunkSize) {
        const chunk = allRows.slice(i, i + chunkSize);
        await bqTable.insert(chunk);
      }
      console.log("✅ Carga de Yotpo Completada con Éxito.");
    }
  } catch (err) {
    console.error("❌ Error en sincronización Yotpo:", err);
  }
}

runSync();
