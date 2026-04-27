require('dotenv').config();

async function testShopify() {
  const token = process.env.SHOPIFY_API_TOKEN;
  const domain = process.env.SHOPIFY_DOMAIN;
  
  if (!token || !domain) {
    return { status: '❌ Faltan variables (Token o Dominio)', service: 'Shopify' };
  }

  try {
    const res = await fetch(`https://${domain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (res.ok) {
      const data = await res.json();
      return { status: `✅ Conexión Exitosa. Tienda: ${data.shop.name}`, service: 'Shopify' };
    } else {
      return { status: `❌ Fallo: ${res.statusText} (${res.status})`, service: 'Shopify' };
    }
  } catch (e) {
    return { status: `❌ Error: ${e.message}`, service: 'Shopify' };
  }
}

async function testKlaviyo() {
  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  try {
    const res = await fetch('https://a.klaviyo.com/api/metrics/', {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'accept': 'application/json',
        'revision': '2023-10-15'
      }
    });
    if (res.ok) {
      return { status: '✅ Conexión Exitosa', service: 'Klaviyo' };
    } else {
      return { status: `❌ Fallo: ${res.statusText}`, service: 'Klaviyo' };
    }
  } catch (e) {
    return { status: `❌ Error: ${e.message}`, service: 'Klaviyo' };
  }
}

async function testCrisp() {
  const identifier = process.env.CRISP_IDENTIFIER;
  const key = process.env.CRISP_KEY;
  const websiteId = process.env.CRISP_WEBSITE_ID;
  const auth = Buffer.from(`${identifier}:${key}`).toString('base64');
  
  if (!websiteId) {
    return { status: '❌ Falta Website ID', service: 'Crisp.chat' };
  }

  try {
    // Intentaremos obtener estadísticas del sitio para validar que tenemos acceso
    const res = await fetch(`https://api.crisp.chat/v1/website/${websiteId}/conversations/1`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'X-Crisp-Tier': 'plugin'
      }
    });
    
    // Si retorna 404 significa que autenticó pero no existe el conv 1 (esperado). 401/403 es error de auth.
    if (res.status !== 401 && res.status !== 403) {
      return { status: '✅ Autenticación y Acceso al Website ID Exitosos', service: 'Crisp.chat' };
    } else {
      return { status: `❌ Fallo de Auth o Permisos: ${res.statusText} (${res.status})`, service: 'Crisp.chat' };
    }
  } catch (e) {
    return { status: `❌ Error: ${e.message}`, service: 'Crisp.chat' };
  }
}

async function runTests() {
  console.log("=== VERIFICACIÓN FINAL (FASE 1) ===\n");
  
  const shopify = await testShopify();
  console.log(`[${shopify.service}]: ${shopify.status}`);
  
  const klaviyo = await testKlaviyo();
  console.log(`[${klaviyo.service}]: ${klaviyo.status}`);
  
  const crisp = await testCrisp();
  console.log(`[${crisp.service}]: ${crisp.status}`);
}

runTests();
