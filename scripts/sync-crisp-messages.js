require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const language = require('@google-cloud/language');
const crypto = require('crypto');

const DATASET_ID = 'ecommerce_data';

// Retardo para evitar rate limits
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setupBigQuery(bq) {
  const dataset = bq.dataset(DATASET_ID);
  
  const schema = [
    { name: 'message_id', type: 'STRING', mode: 'REQUIRED' },
    { name: 'session_id', type: 'STRING' },
    { name: 'created_at', type: 'TIMESTAMP' },
    { name: 'sender_type', type: 'STRING' },
    { name: 'content', type: 'STRING' },
    { name: 'sentiment_score', type: 'FLOAT' },
    { name: 'sentiment_magnitude', type: 'FLOAT' }
  ];

  const table = dataset.table('crisp_messages');
  const [exists] = await table.exists();
  if (!exists) {
    console.log("Creando tabla crisp_messages...");
    await dataset.createTable('crisp_messages', { schema });
  } else {
    // Si queremos borrar para historial:
    console.log("Limpiando tabla crisp_messages...");
    try {
      await bq.query(`TRUNCATE TABLE \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_messages\``);
    } catch(e) {}
  }
  return table;
}

async function fetchMessagesForSession(session_id, auth, websiteId) {
  let retries = 5;
  while (retries > 0) {
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversation/${session_id}/messages`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'X-Crisp-Tier': 'plugin'
      }
    });

    if (res.status === 429) {
      await sleep(10000); // 10 segundos
      retries--;
    } else if (res.ok) {
      const json = await res.json();
      return json.data || [];
    } else {
      break;
    }
  }
  return [];
}

async function analyzeSentiment(nlpClient, text) {
  try {
    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };
    const [result] = await nlpClient.analyzeSentiment({ document: document });
    const sentiment = result.documentSentiment;
    return {
      score: sentiment.score,
      magnitude: sentiment.magnitude
    };
  } catch (error) {
    console.log(`Error al analizar sentimiento: ${error.message}`);
    return { score: null, magnitude: null };
  }
}

async function runMessagesSync() {
  console.log("=== INICIANDO EXTRACCIÓN Y NLP DE MENSAJES DE CRISP ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const nlpClient = new language.LanguageServiceClient();

    const identifier = process.env.CRISP_IDENTIFIER;
    const key = process.env.CRISP_KEY;
    const websiteId = process.env.CRISP_WEBSITE_ID;
    const auth = Buffer.from(`${identifier}:${key}`).toString('base64');

    const bqTable = await setupBigQuery(bigquery);

    // Obtener las sesiones
    const [rows] = await bigquery.query(`SELECT session_id FROM \`${process.env.GCP_PROJECT_ID}.${DATASET_ID}.crisp_conversations\``);
    
    console.log(`Se encontraron ${rows.length} conversaciones para procesar.`);

    let totalMessages = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const session_id = rows[i].session_id;
      const messages = await fetchMessagesForSession(session_id, auth, websiteId);

      const bqRows = [];
      for (const msg of messages) {
        if (msg.type !== 'text') continue; // Solo nos importa texto

        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const sender = msg.from; // 'user', 'operator', etc.
        let sentiment_score = null;
        let sentiment_magnitude = null;

        // Solo analizamos el sentimiento del usuario
        if (sender === 'user' && content.length > 3) {
          const sentiment = await analyzeSentiment(nlpClient, content);
          sentiment_score = sentiment.score;
          sentiment_magnitude = sentiment.magnitude;
        }

        bqRows.push({
          message_id: msg.fingerprint || crypto.randomUUID(),
          session_id: session_id,
          created_at: bigquery.datetime(new Date(msg.timestamp).toISOString()),
          sender_type: sender,
          content: content,
          sentiment_score: sentiment_score,
          sentiment_magnitude: sentiment_magnitude
        });
      }

      if (bqRows.length > 0) {
        await bqTable.insert(bqRows);
        totalMessages += bqRows.length;
      }
      
      process.stdout.write(`\rProcesadas ${i + 1}/${rows.length} sesiones. Mensajes extraídos: ${totalMessages}`);
      await sleep(500); // Anti-rate limit
    }

    console.log(`\n\n✅ Finalizado. ${totalMessages} mensajes insertados en crisp_messages.`);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

runMessagesSync();
