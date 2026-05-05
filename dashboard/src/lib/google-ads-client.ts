/**
 * Google Ads API Client — Módulo reutilizable
 * 
 * Centraliza la inicialización del cliente de Google Ads API
 * para ser usado por cualquier API route del dashboard.
 */

import { GoogleAdsApi } from 'google-ads-api';

let clientInstance: GoogleAdsApi | null = null;

/**
 * Obtiene una instancia singleton del cliente GoogleAdsApi.
 * Usa credenciales desde variables de entorno.
 */
function getClient(): GoogleAdsApi {
  if (!clientInstance) {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

    if (!developerToken || !clientId || !clientSecret) {
      throw new Error(
        'Google Ads API credentials missing. Required env vars: ' +
        'GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET'
      );
    }

    clientInstance = new GoogleAdsApi({
      client_id: clientId,
      client_secret: clientSecret,
      developer_token: developerToken,
    });
  }
  return clientInstance;
}

/**
 * Crea una instancia de Customer autenticada con el refresh token.
 * Opcionalmente acepta un login_customer_id para cuentas MCC.
 */
export function getGoogleAdsCustomer(options?: { loginCustomerId?: string }) {
  const client = getClient();
  
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

  if (!refreshToken || !customerId) {
    throw new Error(
      'Google Ads customer credentials missing. Required env vars: ' +
      'GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID'
    );
  }

  // Remove hyphens from customer ID (API expects plain numbers)
  const cleanCustomerId = customerId.replace(/-/g, '');

  const customerConfig: any = {
    customer_id: cleanCustomerId,
    refresh_token: refreshToken,
  };

  // If using an MCC (Manager Account), set the login_customer_id
  if (options?.loginCustomerId) {
    customerConfig.login_customer_id = options.loginCustomerId.replace(/-/g, '');
  } else if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    customerConfig.login_customer_id = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '');
  }

  return client.Customer(customerConfig);
}
