/**
 * ringcentral.ts — Cliente de API RingCentral para el servidor Next.js.
 *
 * Autenticación: JWT Flow (server-to-server).
 * Requiere:
 *   - RINGCENTRAL_CLIENT_ID      → Client ID de la app en Developer Console
 *   - RINGCENTRAL_CLIENT_SECRET  → Client Secret de la app
 *   - RINGCENTRAL_JWT_TOKEN      → JWT generado en Developer Console (pestaña "Credentials")
 *   - RINGCENTRAL_SERVER         → https://platform.ringcentral.com (prod)
 *
 * El access token se renueva automáticamente si expira.
 * Scope necesario en la app: ReadCallLog, ReadAccounts.
 */

const RC_SERVER         = process.env.RINGCENTRAL_SERVER         ?? 'https://platform.ringcentral.com';
const RC_CLIENT_ID      = process.env.RINGCENTRAL_CLIENT_ID      ?? '';
const RC_CLIENT_SECRET  = process.env.RINGCENTRAL_CLIENT_SECRET  ?? '';
const RC_JWT_TOKEN      = process.env.RINGCENTRAL_JWT_TOKEN       ?? '';

// ── Token cache (in-process, válido por la vida del servidor) ────────────────
let _cachedToken: string | null = null;
let _tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) {
    return _cachedToken;
  }

  if (!RC_CLIENT_ID || !RC_CLIENT_SECRET || !RC_JWT_TOKEN) {
    throw new Error('RingCentral credentials not configured. Set RINGCENTRAL_CLIENT_ID, RINGCENTRAL_CLIENT_SECRET and RINGCENTRAL_JWT_TOKEN in env.yaml.');
  }

  const credentials = Buffer.from(`${RC_CLIENT_ID}:${RC_CLIENT_SECRET}`).toString('base64');

  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  RC_JWT_TOKEN,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RingCentral auth failed: ${res.status} — ${err}`);
  }

  const data = await res.json();
  _cachedToken    = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return _cachedToken!;
}

/** Ejecuta un GET autenticado a la API REST de RingCentral. */
async function rcGet<T = any>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const url   = new URL(`${RC_SERVER}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RingCentral API error ${res.status} on ${path}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── Endpoints de negocio ─────────────────────────────────────────────────────

/** Resumen de call log de la cuenta para un rango de fechas (account-level). */
export async function getCallLogSummary(dateFrom: string, dateTo: string) {
  return rcGet('/restapi/v1.0/account/~/call-log', {
    dateFrom,
    dateTo,
    perPage: '1000',
    type:    'Voice',
    view:    'Simple',
  });
}

/** Call log detallado de la extensión autenticada. Para call log de toda la cuenta se requiere ReadCompanyCallLog (scope de admin). */
export async function getCallLogDetailed(dateFrom: string, dateTo: string) {
  return rcGet('/restapi/v1.0/account/~/extension/~/call-log', {
    dateFrom,
    dateTo,
    perPage: '1000',
    type:    'Voice',
    view:    'Detailed',
  });
}

/** Call log de una extensión específica por ID. */
export async function getExtensionCallLog(extensionId: string, dateFrom: string, dateTo: string) {
  return rcGet(`/restapi/v1.0/account/~/extension/${extensionId}/call-log`, {
    dateFrom,
    dateTo,
    perPage: '250',
    type:    'Voice',
    view:    'Detailed',
  });
}

/** Extensiones activas de la cuenta (agentes/operadores). */
export async function getExtensions() {
  return rcGet('/restapi/v1.0/account/~/extension', {
    perPage: '200',
    status:  'Enabled',
    type:    'User',
  });
}

export { getAccessToken };
