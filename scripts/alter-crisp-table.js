require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });

async function run() {
  console.log("Altering crisp_conversations table...");
  const query1 = `
    ALTER TABLE \`${process.env.GCP_PROJECT_ID}.ecommerce_data.crisp_conversations\`
    ADD COLUMN IF NOT EXISTS messages_synced BOOLEAN;
  `;
  const [job1] = await bq.createQueryJob({ query: query1 });
  await job1.promise();
  
  console.log("Updating messages_synced for existing sessions...");
  const query2 = `
    UPDATE \`${process.env.GCP_PROJECT_ID}.ecommerce_data.crisp_conversations\` c
    SET messages_synced = TRUE
    WHERE EXISTS (
      SELECT 1 FROM \`${process.env.GCP_PROJECT_ID}.ecommerce_data.crisp_messages\` m
      WHERE m.session_id = c.session_id
    )
  `;
  const [job2] = await bq.createQueryJob({ query: query2 });
  await job2.promise();
  
  console.log("Database update complete.");
}

run().catch(console.error);
