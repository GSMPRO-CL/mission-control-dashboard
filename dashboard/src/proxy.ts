import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

const PUBLIC_PATHS = ['/login', '/signup', '/pending']

export async function proxy(request: NextRequest) {
  const { supabase, supabaseResponse } = createClient(request)
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  const { data: { user } } = await supabase.auth.getUser()

  // No session → send to login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Has session → check profile approval status
  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, approval_status')
      .eq('id', user.id)
      .single()

    if (profile?.approval_status === 'pending') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }

    if (profile?.approval_status === 'rejected') {
      return NextResponse.redirect(new URL('/login?error=rejected', request.url))
    }

    if (pathname.startsWith('/admin') && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Already logged in → skip login/signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
