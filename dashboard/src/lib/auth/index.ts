import { iapProvider } from './providers/iap'
import type { AuthProvider } from './types'

/**
 * Auth Factory — GSMPRO Dashboard
 *
 * Selecciona el proveedor de autenticación según la variable de entorno:
 *
 *   NEXT_PUBLIC_AUTH_PROVIDER=iap       → Autenticación mediante Google Cloud IAP
 *   NEXT_PUBLIC_AUTH_PROVIDER=none      → Sin autenticación
 */
function resolveProvider(): AuthProvider {
  const configured = process.env.NEXT_PUBLIC_AUTH_PROVIDER

  switch (configured) {
    case 'iap':
      return iapProvider
    case 'none':
    default:
      return iapProvider // Por defecto usamos IAP ahora que es la solución estructural
  }
}

const provider = resolveProvider()

export const getUser = provider.getUser.bind(provider)
export const signOut = provider.signOut.bind(provider)
export type { AuthUser } from './types'
