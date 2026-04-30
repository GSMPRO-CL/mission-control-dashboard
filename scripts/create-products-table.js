require('dotenv').config({ path: __dirname + '/../.env' });
const { BigQuery } = require('@google-cloud/bigquery');

const DATASET_ID = 'ecommerce_data';

async function createProductsTables() {
  console.log("=== CREACIÓN DE TABLAS DE PRODUCTOS EN BIGQUERY ===\n");
  try {
    const bigquery = new BigQuery({ projectId: process.env.GCP_PROJECT_ID });
    const dataset = bigquery.dataset(DATASET_ID);

    const productsSchema = [
      { name: 'id', type: 'INT64', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING' },
      { name: 'vendor', type: 'STRING' },
      { name: 'product_type', type: 'STRING' },
      { name: 'status', type: 'STRING' },
      { name: 'handle', type: 'STRING' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP' },
      { name: 'published_at', type: 'TIMESTAMP' }
    ];

    const variantsSchema = [
      { name: 'id', type: 'INT64', mode: 'REQUIRED' },
      { name: 'product_id', type: 'INT64', mode: 'REQUIRED' },
      { name: 'title', type: 'STRING' },
      { name: 'price', type: 'FLOAT64' },
      { name: 'sku', type: 'STRING' },
      { name: 'inventory_quantity', type: 'INT64' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'updated_at', type: 'TIMESTAMP' }
    ];

    // Create shopify_products table
    console.log("Creando tabla shopify_products...");
    try {
      await dataset.createTable('shopify_products', { schema: productsSchema });
      console.log("✅ Tabla shopify_products creada exitosamente.");
    } catch (e) {
      if (e.message.includes('Already Exists')) {
        console.log("⚠️ La tabla shopify_products ya existe.");
      } else {
        throw e;
      }
    }

    // Create shopify_product_variants table
    console.log("Creando tabla shopify_product_variants...");
    try {
      await dataset.createTable('shopify_product_variants', { schema: variantsSchema });
      console.log("✅ Tabla shopify_product_variants creada exitosamente.");
    } catch (e) {
      if (e.message.includes('Already Exists')) {
        console.log("⚠️ La tabla shopify_product_variants ya existe.");
      } else {
        throw e;
      }
    }

  } catch (error) {
    console.error("❌ Error al crear las tablas:", error);
  }
}

createProductsTables();
