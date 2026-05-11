import type { AuthUser, AuthProvider } from '../types'

/**
 * Provider: sin autenticación
 *
 * Usado en Google Cloud Run (producción), donde no hay proveedor
 * de auth configurado. Retorna null sin lanzar errores.
 *
 * Los componentes UI manejan user === null mostrando estado anónimo.
 */
export const noneProvider: AuthProvider = {
  async getUser(): Promise<AuthUser | null> {
    return null
  },

  async signOut(): Promise<void> {
    // Sin sesión que cerrar — no-op intencional
  },
}
