import { GoogleAuth } from 'google-auth-library';

/**
 * Utilidad estandarizada para realizar llamadas HTTP a los microservicios de Python en Cloud Run.
 * Maneja automáticamente la inyección del Token de Identidad OIDC si el entorno es de producción.
 * @param path - Ruta relativa de la API (ej: '/api/v1/calendar/scan')
 * @param options - Opciones nativas del fetch (method, headers, body, etc.)
 */
export async function fetchCloudRun(path: string, options: RequestInit = {}) {
  // Obtenemos la URL base del entorno, fallback a local
  const serviceUrl = process.env.PRODUCT_INTELLIGENCE_URL || 'http://localhost:8000';
  
  // Limpiamos la ruta para evitar dobles slashes
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullUrl = `${serviceUrl}${cleanPath}`;
  
  // Establecemos headers por defecto
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  // Si la URL apunta a un servicio desplegado en Google Cloud Run, inyectamos el Token IAM
  if (serviceUrl.includes('run.app')) {
    try {
      const auth = new GoogleAuth();
      const client = await auth.getIdTokenClient(serviceUrl);
      const authHeaders = await client.getRequestHeaders();
      
      const authHeaderValue = (authHeaders as any).Authorization || (authHeaders as any).authorization;
      if (authHeaderValue) {
        headers['Authorization'] = authHeaderValue;
      }
    } catch (error) {
      console.warn("No se pudo generar el Token OIDC para Cloud Run. La petición podría fallar con 403:", error);
    }
  }

  // Ejecutamos el fetch de forma estándar
  return fetch(fullUrl, {
    ...options,
    headers,
  });
}
