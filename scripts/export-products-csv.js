require('dotenv').config({ path: __dirname + '/../.env' });
const fs = require('fs');
const path = require('path');

async function fetchAllShopifyProducts() {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;
  
  let allProducts = [];
  // Using REST API as in sync-shopify-products.js
  let url = `https://${domain}/admin/api/2024-01/products.json?limit=250`;

  console.log(`Extrayendo todos los productos de Shopify...`);

  while (url) {
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      throw new Error(`Error Shopify: ${res.statusText}`);
    }

    const data = await res.json();
    allProducts = allProducts.concat(data.products);
    
    process.stdout.write(`\rDescargados: ${allProducts.length} productos...`);

    // Pagination logic
    const linkHeader = res.headers.get('link');
    url = null;
    if (linkHeader) {
      const links = linkHeader.split(',');
      const nextLink = links.find(link => link.includes('rel="next"'));
      if (nextLink) {
        const match = nextLink.match(/<([^>]+)>/);
        if (match) {
          url = match[1];
        }
      }
    }
  }
  
  console.log(`\nExtracción completada. Total: ${allProducts.length} productos obtenidos.`);
  return allProducts;
}

async function exportCSV() {
  try {
    const products = await fetchAllShopifyProducts();
    
    console.log(`Generando CSV...`);
    
    const csvHeader = 'id,title,vendor,product_type,status,handle\n';
    const csvRows = products.map(r => {
      const escape = (str) => {
        if (!str) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      return `${r.id},${escape(r.title)},${escape(r.vendor)},${escape(r.product_type)},${escape(r.status)},${escape(r.handle)}`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    const filePath = path.join(__dirname, '..', 'productos_shopify.csv');
    fs.writeFileSync(filePath, csvContent, 'utf-8');
    
    console.log(`✅ CSV generado exitosamente en: ${filePath}`);
  } catch (err) {
    console.error("❌ Error exportando CSV:", err);
  }
}

exportCSV();
