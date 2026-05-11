'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Users, RefreshCw, ShieldCheck, Shield } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

const STATUS_STYLES = {
  pending:  'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' };

export default function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      setError('No se pudieron cargar los usuarios.');
    } else {
      setUsers(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAction(userId: string, action: 'approved' | 'rejected') {
    setActionLoading(userId + action);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    });
    if (res.ok) {
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, approval_status: action } : u)
      );
    }
    setActionLoading(null);
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'user') {
    setRoleLoading(userId);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'set_role', role: newRole }),
    });
    if (res.ok) {
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, role: newRole } : u)
      );
    }
    setRoleLoading(null);
  }

  const pending  = users.filter(u => u.approval_status === 'pending');
  const approved = users.filter(u => u.approval_status === 'approved');
  const rejected = users.filter(u => u.approval_status === 'rejected');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de Administración</h1>
          <p className="text-zinc-400 text-sm mt-1">Gestiona el acceso de usuarios al dashboard</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 transition-colors text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', count: pending.length,  icon: Clock,       color: 'text-amber-400',  bg: 'bg-amber-500/10' },
          { label: 'Aprobados',  count: approved.length, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Rechazados', count: rejected.length, icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10' },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <div key={label} className="p-4 rounded-2xl border border-white/10 bg-white/5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{count}</p>
              <p className="text-xs text-zinc-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Users table */}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <Users className="w-4 h-4 text-zinc-400" />
          <h2 className="text-sm font-semibold text-white">Todos los usuarios</h2>
          <span className="ml-auto text-xs text-zinc-500">{users.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-500 text-sm">No hay usuarios registrados aún.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-6 py-3 font-medium">Usuario</th>
                  <th className="text-left px-6 py-3 font-medium">Rol</th>
                  <th className="text-left px-6 py-3 font-medium">Estado</th>
                  <th className="text-left px-6 py-3 font-medium">Registrado</th>
                  <th className="text-right px-6 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{user.full_name || '—'}</p>
                      <p className="text-zinc-500 text-xs">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-white/5 text-zinc-400 border border-white/10'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[user.approval_status]}`}>
                        {STATUS_LABELS[user.approval_status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.id === currentUserId ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-zinc-500 border border-white/10">Tú</span>
                        ) : (
                          <>
                            {user.approval_status !== 'approved' && (
                              <button
                                onClick={() => handleAction(user.id, 'approved')}
                                disabled={actionLoading === user.id + 'approved'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs disabled:opacity-50"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                Aprobar
                              </button>
                            )}
                            {user.approval_status !== 'rejected' && (
                              <button
                                onClick={() => handleAction(user.id, 'rejected')}
                                disabled={actionLoading === user.id + 'rejected'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-xs disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Rechazar
                              </button>
                            )}
                            {user.role === 'user' ? (
                              <button
                                onClick={() => handleRoleChange(user.id, 'admin')}
                                disabled={roleLoading === user.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs disabled:opacity-50"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Hacer Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRoleChange(user.id, 'user')}
                                disabled={roleLoading === user.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors text-xs disabled:opacity-50"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                Quitar Admin
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
