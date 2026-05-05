'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, User, Clock, Hash, Filter } from 'lucide-react';

interface SummaryData {
  staff_id: string;
  full_name: string;
  action: string;
  event_count: number;
  last_activity: { value: string };
}

interface EventData {
  audit_id: string;
  occurred_at: { value: string };
  full_name: string;
  action: string;
  subject_type: string;
  subject_id: string;
}

export default function EquipoActividadPage() {
  const [summary, setSummary] = useState<SummaryData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    fetch('/api/equipo/actividad')
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setSummary(data.summary || []);
        setEvents(data.recentEvents || []);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Obtener lista de acciones únicas para el filtro
  const uniqueActions = Array.from(new Set(summary.map(s => s.action))).sort();

  // Filtrar y agrupar datos para el gráfico
  const chartDataMap = summary.reduce((acc, curr) => {
    if (filterAction !== 'all' && curr.action !== filterAction) return acc;
    
    if (!acc[curr.full_name]) {
      acc[curr.full_name] = { name: curr.full_name, total: 0 };
    }
    acc[curr.full_name].total += curr.event_count;
    return acc;
  }, {} as Record<string, { name: string, total: number }>);
  
  const chartData = Object.values(chartDataMap).sort((a, b) => b.total - a.total);

  // Calcular métrica global filtrada
  const filteredTotalEvents = chartData.reduce((acc, curr) => acc + curr.total, 0);

  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-1/3 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] col-span-2" />
          <Skeleton className="h-[400px]" />
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">
          ❌ Error cargando actividad: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-slate-100">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">
            Actividad del Equipo
          </h1>
          <p className="text-slate-400 mt-2">Monitoreo y atribución de acciones en Shopify Audit Logs</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800/80 p-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400 ml-2" />
            <select 
              value={filterAction} 
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-transparent text-slate-200 text-sm font-medium focus:outline-none border-none cursor-pointer px-2 py-1"
            >
              <option value="all" className="bg-slate-800">Todas las acciones</option>
              {uniqueActions.map(action => (
                <option key={action} value={action} className="bg-slate-800">{action}</option>
              ))}
            </select>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-400" />
            <span className="font-semibold text-xl">{filteredTotalEvents}</span>
            <span className="text-slate-400 text-sm">Eventos Atribuidos</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico Principal */}
        <Card className="col-span-2 bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Operaciones por Empleado {filterAction !== 'all' && <span className="text-emerald-400 text-sm ml-2">({filterAction})</span>}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px] w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
              <div style={{ width: Math.max(chartData.length * 60, 600), height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: '#1e293b' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Acciones */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Top Tipos de Acción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary.slice(0, 6).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 transition">
                  <div className="flex flex-col">
                    <span className="font-medium text-emerald-400 text-sm">{item.action}</span>
                    <span className="text-xs text-slate-400">{item.full_name}</span>
                  </div>
                  <span className="bg-slate-700/50 text-slate-200 px-3 py-1 rounded-full text-xs font-semibold">
                    {item.event_count}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Registros */}
      <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-400" />
            Últimos Eventos Registrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4 font-semibold">Fecha y Hora</th>
                  <th className="p-4 font-semibold">Empleado</th>
                  <th className="p-4 font-semibold">Acción</th>
                  <th className="p-4 font-semibold">Recurso</th>
                  <th className="p-4 font-semibold text-right">ID Referencia</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {events.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-300">
                      {new Date(evt.occurred_at?.value).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xs font-bold text-slate-900">
                          {evt.full_name.charAt(0)}
                        </div>
                        <span className="font-medium">{evt.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                        {evt.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 capitalize">{evt.subject_type?.toLowerCase().replace('_', ' ') || 'N/A'}</td>
                    <td className="p-4 text-right text-slate-500 font-mono text-xs">{evt.subject_id || '-'}</td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No hay eventos recientes.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
