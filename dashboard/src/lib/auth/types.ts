/**
 * Contrato canónico de autenticación — GSMPRO Dashboard
 *
 * Todos los componentes UI consumen este tipo, no el tipo específico
 * de ningún proveedor (Supabase, Google, etc.).
 */

export interface AuthUser {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'user'
}

export interface AuthProvider {
  getUser: () => Promise<AuthUser | null>
  signOut: () => Promise<void>
}
