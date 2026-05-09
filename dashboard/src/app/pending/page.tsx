'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function PendingPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        <div className="glass-card">
          {/* Icon */}
          <div className="w-20 h-20 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(245,158,11,0.1)]">
            <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Acceso pendiente</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-2">
            Tu cuenta está pendiente de aprobación por un administrador de GMS PRO.
          </p>
          <p className="text-zinc-600 text-xs leading-relaxed">
            Una vez aprobado, podrás ingresar automáticamente. No necesitas hacer nada más.
          </p>

          <div className="mt-8 pt-6 border-t border-white/5">
            <button
              onClick={handleSignOut}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-700 mt-6">
          GMS PRO · Acceso restringido a personal autorizado
        </p>
      </div>
    </div>
  );
}
