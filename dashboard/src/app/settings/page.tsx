'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Shield, CheckCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

type Profile = { email: string; full_name: string | null; role: string; approval_status: string };

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName]       = useState('');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('email, full_name, role, approval_status')
        .eq('id', user.id)
        .single();
      if (data) { setProfile(data); setName(data.full_name ?? ''); }
    });
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
      setProfile(prev => prev ? { ...prev, full_name: name } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Preferencias</h1>
        <p className="text-zinc-400 text-sm mt-1">Administra tu perfil y configuración de cuenta</p>
      </div>

      {/* Profile card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <User className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Perfil</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Nombre completo</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Correo electrónico</label>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10">
              <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
              <span className="text-sm text-zinc-300">{profile?.email ?? '—'}</span>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !profile}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Account info card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <Shield className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Cuenta</h2>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Rol</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${profile?.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
              {profile?.role ?? '—'}
            </span>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Estado</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              profile?.approval_status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              profile?.approval_status === 'pending'  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {profile?.approval_status === 'approved' ? 'Aprobado' : profile?.approval_status === 'pending' ? 'Pendiente' : 'Rechazado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
