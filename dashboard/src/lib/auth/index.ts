import { noneProvider } from './providers/none'
import { supabaseProvider } from './providers/supabase'
import type { AuthProvider } from './types'

/**
 * Auth Factory — GSMPRO Dashboard
 *
 * Selecciona el proveedor de autenticación según la variable de entorno:
 *
 *   NEXT_PUBLIC_AUTH_PROVIDER=supabase  → Vercel / staging (colaborador)
 *   NEXT_PUBLIC_AUTH_PROVIDER=none      → Cloud Run / producción (default)
 *
 * Para agregar un nuevo proveedor (ej: Google Identity):
 *   1. Crear `providers/google.ts` implementando AuthProvider
 *   2. Agregar el case aquí
 *   3. Los componentes UI no cambian
 */
function resolveProvider(): AuthProvider {
  const configured = process.env.NEXT_PUBLIC_AUTH_PROVIDER

  switch (configured) {
    case 'supabase':
      return supabaseProvider
    case 'none':
    default:
      // Default seguro: sin auth, sin crash — correcto para Cloud Run
      return noneProvider
  }
}

const provider = resolveProvider()

export const getUser = provider.getUser.bind(provider)
export const signOut = provider.signOut.bind(provider)
export type { AuthUser } from './types'
