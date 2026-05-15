import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // En entorno local (desarrollo), omitimos IAP auth para permitir trabajar libremente
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // Lista blanca de correos sacada de .env
  const ADMIN_EMAILS = (process.env.DASHBOARD_ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);

  const USER_EMAILS = (process.env.DASHBOARD_USER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length > 0);

  // Leer header inyectado por IAP en producción
  const iapEmailHeader = request.headers.get('x-goog-authenticated-user-email');
  
  // Si existe el header de IAP, significa que el usuario pasó la pantalla de login de Google
  if (iapEmailHeader) {
    // IAP format: accounts.google.com:example@gmail.com
    const cleanEmail = iapEmailHeader.replace('accounts.google.com:', '').toLowerCase();

    // Verificamos si está en nuestras listas blancas del .env (u otra BBDD futura)
    const isAuthorized = ADMIN_EMAILS.includes(cleanEmail) || USER_EMAILS.includes(cleanEmail);

    if (!isAuthorized) {
      // Bloqueamos con un 403 y retornamos HTML bonito y estructurado
      const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Acceso Denegado - GSMPRO Dashboard</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f3f4f6; color: #1f2937; }
            .card { background: white; padding: 2.5rem 3rem; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); text-align: center; max-width: 450px; border-top: 4px solid #dc2626; }
            h1 { color: #dc2626; margin-top: 0; font-size: 1.5rem; }
            p { margin-bottom: 1.5rem; line-height: 1.6; color: #4b5563; font-size: 0.95rem; }
            .email { font-weight: 600; color: #111827; background: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid #e5e7eb; display: inline-block; margin-top: 0.5rem; margin-bottom: 0.5rem;}
            .btn { display: inline-block; padding: 0.6rem 1.2rem; background-color: #111827; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; transition: background-color 0.2s; font-size: 0.9rem; }
            .btn:hover { background-color: #374151; }
            .icon { font-size: 3rem; margin-bottom: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">🛑</div>
            <h1>Acceso Denegado</h1>
            <p>Tu cuenta de Google ha sido autenticada exitosamente, pero <strong>no tienes permiso</strong> para acceder a este Dashboard corporativo.</p>
            <span class="email">${cleanEmail}</span>
            <p>Por favor, contacta al administrador del sistema para que autorice tu correo.</p>
            <a href="/_gcp_iap/clear_login_cookie" class="btn">Cambiar de Cuenta de Google</a>
          </div>
        </body>
      </html>
      `;
      return new NextResponse(html, {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }

  // Dejamos pasar si está autorizado o si no hay header de IAP 
  // (tráfico interno o rutinas Server-to-Server)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplicar a todo excepto archivos estáticos (imágenes, fuentes, etc.)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
