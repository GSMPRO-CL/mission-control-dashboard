import type { AuthUser, AuthProvider } from '../types'

/**
 * Provider: Supabase Auth
 *
 * Usado en Vercel (staging/colaborador). Requiere:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *
 * Es el ÚNICO archivo en la capa de UI que importa el cliente de Supabase.
 * Todos los demás componentes consumen el contrato AuthUser.
 */
async function getSupabaseClient() {
  // Import dinámico — garantiza que createClient solo se llama
  // cuando este provider está activo y las variables existen
  const { createClient } = await import('@/utils/supabase/client')
  return createClient()
}

export const supabaseProvider: AuthProvider = {
  async getUser(): Promise<AuthUser | null> {
    const supabase = await getSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name, role')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    return {
      id: user.id,
      email: profile.email ?? user.email ?? '',
      full_name: profile.full_name ?? null,
      role: profile.role === 'admin' ? 'admin' : 'user',
    }
  },

  async signOut(): Promise<void> {
    const supabase = await getSupabaseClient()
    await supabase.auth.signOut()
  },
}
