const { GoogleAuth } = require('google-auth-library');

async function test() {
  console.log("Generando token OIDC y conectando con Cloud Run...");
  const serviceUrl = 'https://product-intelligence-service-uxqmnnhz3a-uc.a.run.app';
  const path = '/api/v1/calendar/scan';
  const fullUrl = `${serviceUrl}${path}`;
  
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(serviceUrl);
  const authHeaders = await client.getRequestHeaders();
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    }
  });
  
  const data = await response.json();
  console.log("Status Code:", response.status);
  console.log("Respuesta:", JSON.stringify(data, null, 2));
}

test().catch(console.error);
