import { NextResponse, type NextRequest } from 'next/server'

/**
 * proxy.ts — Next.js 16 middleware convention
 *
 * Entorno de producción: Google Cloud Run.
 * La autenticación se maneja a nivel de componente/API route,
 * no en el middleware global.
 *
 * El flujo de auth Supabase (colaborador) fue desacoplado porque
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 * no están disponibles en producción (Cloud Run).
 */
export async function proxy(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
