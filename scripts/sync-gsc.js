require('dotenv').config();
const { google } = require('googleapis');
const { BigQuery } = require('@google-cloud/bigquery');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DATASET_ID = 'ecommerce_data';
const TARGET_TABLE = 'gsc_metrics';
const PROPERTIES = ['sc-domain:gsmpro.cl', 'sc-domain:gsmpro.com'];

// Para inicializar autenticación (usará Application Default Credentials o GOOGLE_APPLICATION_CREDENTIALS)
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
});

const searchconsole = google.searchconsole({
  version: 'v1',
  auth: auth
});

async function fetchGSCData(property, startDate, endDate) {
  console.log(`Extrayendo datos de GSC para ${property} desde ${startDate} hasta ${endDate}...`);
  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: property,
      requestBody: {
        startDate: startDate,
        endDate: endDate,
        dimensions: ['date', 'page', 'query'],
        rowLimit: 25000 // Máximo permitido por la API por petición
      }
    });

    const rows = res.data.rows || [];
    console.log(`Obtenidas ${rows.length} filas para ${property}.`);
    return rows;
  } catch (err) {
    console.error(`Error al extraer datos para ${property}:`, err.message);
    return [];
  }
}

function generateId(date, property, page, query) {
  const hash = crypto.createHash('md5');
  hash.update(`${date}-${property}-${page}-${query}`);
  return hash.digest('hex');
}

async function runSync() {
  console.log("=== INICIANDO SINCRONIZACIÓN GOOGLE SEARCH CONSOLE -> BIGQUERY ===\n");
  
  try {
    const projectId = process.env.GCP_PROJECT_ID;
    const bigquery = new BigQuery({ projectId });
    const dataset = bigquery.dataset(DATASET_ID);

    // Definir el rango de fechas (ej: últimos 7 días)
    const end = new Date();
    end.setDate(end.getDate() - 1); // Ayer (GSC suele tener 1 día de retraso)
    const endDateStr = end.toISOString().split('T')[0];
    
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    const startDateStr = start.toISOString().split('T')[0];

    let allBqRows = [];

    for (const property of PROPERTIES) {
      const rows = await fetchGSCData(property, startDateStr, endDateStr);
      
      const bqRows = rows.map(r => {
        // GSC devuelve un array de "keys" en el mismo orden que "dimensions"
        // ['date', 'page', 'query']
        const dateStr = r.keys[0];
        const pageStr = r.keys[1];
        const queryStr = r.keys[2];

        return {
          id: generateId(dateStr, property, pageStr, queryStr),
          date: dateStr,
          property: property,
          page: pageStr,
          query: queryStr,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position
        };
      });

      allBqRows = allBqRows.concat(bqRows);
    }

    if (allBqRows.length === 0) {
      console.log("No hay datos de GSC para sincronizar en este periodo.");
      return;
    }

    // 1. Guardar en un archivo NDJSON temporal
    const timestamp = Date.now();
    const stagingTableName = `gsc_metrics_staging_${timestamp}`;
    const tempFilePath = path.join(os.tmpdir(), `${stagingTableName}.ndjson`);
    const ndjsonContent = allBqRows.map(obj => JSON.stringify(obj)).join('\n');
    fs.writeFileSync(tempFilePath, ndjsonContent);

    // 2. Crear tabla temporal (Staging)
    const stagingTable = dataset.table(stagingTableName);
    const targetTable = dataset.table(TARGET_TABLE);
    const [metadata] = await targetTable.getMetadata();
    const schema = metadata.schema;

    console.log(`Creando tabla staging ${stagingTableName}...`);
    await stagingTable.create({ schema });

    console.log(`Cargando datos en ${stagingTableName} (Load Job)...`);
    await stagingTable.load(tempFilePath, {
      sourceFormat: 'NEWLINE_DELIMITED_JSON'
    });
    fs.unlinkSync(tempFilePath);

    // 3. Ejecutar UPSERT (MERGE)
    const targetPath = `\`${projectId}.${DATASET_ID}.${TARGET_TABLE}\``;
    const stagingPath = `\`${projectId}.${DATASET_ID}.${stagingTableName}\``;

    const query = `
      MERGE ${targetPath} T
      USING ${stagingPath} S
      ON T.id = S.id
      WHEN MATCHED THEN
        UPDATE SET 
          clicks = S.clicks,
          impressions = S.impressions,
          ctr = S.ctr,
          position = S.position
      WHEN NOT MATCHED THEN
        INSERT (id, date, property, page, query, clicks, impressions, ctr, position)
        VALUES (S.id, S.date, S.property, S.page, S.query, S.clicks, S.impressions, S.ctr, S.position)
    `;

    console.log(`Ejecutando MERGE para ${TARGET_TABLE}...`);
    const [job] = await bigquery.createQueryJob({ query });
    await job.promise();
    console.log(`✅ MERGE completado para ${TARGET_TABLE}.`);

    // 4. Limpiar staging
    console.log("Limpiando tabla de staging...");
    await stagingTable.delete();

    console.log("\n✅ Sincronización de GSC Completada con Éxito.");

  } catch (err) {
    console.error("❌ Error durante la sincronización:", err);
  }
}

runSync();
