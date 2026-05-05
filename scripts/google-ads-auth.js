/**
 * Google Ads OAuth2 — Generador de Refresh Token
 * 
 * Este script se ejecuta UNA SOLA VEZ para obtener el refresh_token necesario
 * para que el dashboard pueda consultar la API de Google Ads.
 * 
 * Prerequisitos:
 *   1. Tener credenciales OAuth2 creadas en Google Cloud Console
 *      (APIs & Services > Credentials > Create OAuth Client ID > Web Application)
 *   2. Agregar http://localhost:9090/oauth2callback como Authorized Redirect URI
 *   3. Configurar GOOGLE_ADS_CLIENT_ID y GOOGLE_ADS_CLIENT_SECRET en el .env raíz
 * 
 * Uso:
 *   node scripts/google-ads-auth.js
 */

require('dotenv').config();
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:9090/oauth2callback';
const SCOPE = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Error: Falta GOOGLE_ADS_CLIENT_ID o GOOGLE_ADS_CLIENT_SECRET en el archivo .env');
  console.error('');
  console.error('Pasos para obtenerlos:');
  console.error('  1. Ve a https://console.cloud.google.com/apis/credentials');
  console.error('  2. Click en "Create Credentials" > "OAuth client ID"');
  console.error('  3. Selecciona tipo "Web application"');
  console.error('  4. En "Authorized redirect URIs" agrega: http://localhost:9090/oauth2callback');
  console.error('  5. Copia el Client ID y Client Secret al archivo .env');
  process.exit(1);
}

// Build the authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('');
console.log('🔐 Google Ads OAuth2 — Generador de Refresh Token');
console.log('════════════════════════════════════════════════════');
console.log('');
console.log('Abre esta URL en tu navegador para autorizar la aplicación:');
console.log('');
console.log(authUrl.toString());
console.log('');
console.log('Esperando autorización en http://localhost:9090/oauth2callback ...');

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  
  if (parsedUrl.pathname === '/oauth2callback') {
    const code = parsedUrl.query.code;
    const error = parsedUrl.query.error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Error de autorización</h1><p>${error}</p>`);
      console.error('❌ Error de autorización:', error);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>No se recibió código de autorización</h1>');
      return;
    }

    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(`${tokens.error}: ${tokens.error_description}`);
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: sans-serif; padding: 40px; background: #111; color: #fff;">
            <h1 style="color: #4ade80;">✅ Autorización Exitosa</h1>
            <p>Ya puedes cerrar esta pestaña y volver a la terminal.</p>
          </body>
        </html>
      `);

      console.log('');
      console.log('✅ ¡Autorización exitosa!');
      console.log('════════════════════════════════════════════════════');
      console.log('');
      console.log('Refresh Token:');
      console.log(tokens.refresh_token);
      console.log('');
      console.log('Agrega este valor a tu archivo .env:');
      console.log(`GOOGLE_ADS_REFRESH_TOKEN="${tokens.refresh_token}"`);
      console.log('');

      server.close();
      process.exit(0);

    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Error al intercambiar el código</h1><pre>${err.message}</pre>`);
      console.error('❌ Error:', err.message);
      server.close();
      process.exit(1);
    }
  }
});

server.listen(9090, () => {
  // Try to open browser automatically
  const { exec } = require('child_process');
  exec(`xdg-open "${authUrl.toString()}" 2>/dev/null || open "${authUrl.toString()}" 2>/dev/null`);
});
