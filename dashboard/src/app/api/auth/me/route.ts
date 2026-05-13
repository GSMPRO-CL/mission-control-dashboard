import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const ADMIN_EMAILS = (process.env.DASHBOARD_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

export async function GET() {
  const headersList = await headers();
  let email = headersList.get('x-goog-authenticated-user-email') || headersList.get('x-user-email');

  // Si estamos en entorno de desarrollo local sin IAP
  if (!email && process.env.NODE_ENV === 'development') {
    email = process.env.LOCAL_TEST_USER || 'admin@proshoproyal.net';
  }

  if (!email) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // IAP envuelve el email así: accounts.google.com:usuario@dominio.com
  const cleanEmail = email.replace('accounts.google.com:', '').toLowerCase();
  
  // Asignar rol
  const isAdmin = ADMIN_EMAILS.includes(cleanEmail);
  const role = isAdmin ? 'admin' : 'user';

  const user = {
    id: cleanEmail,
    email: cleanEmail,
    full_name: cleanEmail.split('@')[0], // Aproximación
    role
  };

  return NextResponse.json({ user });
}
