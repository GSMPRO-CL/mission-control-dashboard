'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Cpu, RefreshCw, Search, CheckCircle2, AlertTriangle,
  Calendar, Rocket, Package, Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LaunchRow {
  id:                   string;
  producto:             string;
  marca:                string;
  categoria:            string;
  especificaciones_clave: string;
  fuente:               string;
  estado_db:            'EXISTENTE' | 'NUEVO';
  fecha_escaneo:        string;
}

const COLORS = ['#3b82f6','#a855f7','#ec4899','#22c55e','#f59e0b','#06b6d4','#ef4444','#8b5cf6'];

export default function LanzamientosPage() {
  const [mounted, setMounted]           = useState(false);
  const [data, setData]                 = useState<LaunchRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [scanning, setScanning]         = useState(false);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [search, setSearch]             = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted) loadData();
  }, [mounted]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/inteligencia-mercado/lanzamientos');
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res  = await fetch('/api/inteligencia-mercado/lanzamientos', { method: 'POST' });
      const json = await res.json();
      alert(json.message || 'Escaneo finalizado');
      loadData();
    } catch {
      alert('Error ejecutando el rastreo de IA.');
    } finally {
      setScanning(false);
    }
  };

  // Group by scan date
  const grouped = data.reduce<Record<string, LaunchRow[]>>((acc, row) => {
    const key = row.fecha_escaneo || 'Sin fecha';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const scanDates = Object.keys(grouped).sort((a, b) => {
    const ta = new Date(a).getTime(), tb = new Date(b).getTime();
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return 1;
    if (isNaN(tb)) return -1;
    return tb - ta;
  });

  useEffect(() => {
    if (scanDates.length > 0 && !selectedScan) setSelectedScan(scanDates[0]);
  }, [scanDates.length]);

  const display = (selectedScan && grouped[selectedScan] ? grouped[selectedScan] : [])
    .filter(r => !search || r.producto.toLowerCase().includes(search.toLowerCase()) || r.marca.toLowerCase().includes(search.toLowerCase()));

  // Category chart data
  const catCounts = display.reduce<Record<string, number>>((acc, r) => {
    acc[r.categoria || 'Otro'] = (acc[r.categoria || 'Otro'] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

  const newCount      = display.filter(r => r.estado_db !== 'EXISTENTE').length;
  const existingCount = display.filter(r => r.estado_db === 'EXISTENTE').length;

  const formatDate = (iso: string) => {
    if (!mounted || !iso || iso === 'Sin fecha') return 'Desconocida';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Lanzamientos de Productos</h1>
          <p className="text-zinc-400 mt-1">
            Monitoreo autónomo de novedades del mercado vía Vertex AI.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
        >
          <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
          {scanning ? 'Escaneando…' : 'Forzar Escaneo IA'}
        </button>
      </div>

      {/* Scan selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <span className="text-sm text-zinc-400 font-medium">Escaneo:</span>
        <select
          className="bg-zinc-900/60 border border-white/10 text-white rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500/50 transition-colors"
          value={selectedScan || ''}
          onChange={e => setSelectedScan(e.target.value)}
          disabled={loading || scanDates.length === 0}
        >
          {scanDates.length === 0 && <option>Sin ejecuciones</option>}
          {scanDates.map((d, i) => (
            <option key={d} value={d} className="bg-zinc-900">
              {i === 0 ? '🟢 Último: ' : '🕐 Anterior: '}{formatDate(d)}
            </option>
          ))}
        </select>
        {!loading && selectedScan && (
          <span className="text-xs text-zinc-500">{grouped[selectedScan]?.length ?? 0} productos detectados</span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total detectados"    value={loading ? '…' : String(display.length)}     sub="En el escaneo seleccionado" icon={Cpu}         color="blue"    />
        <KpiCard label="Novedades"           value={loading ? '…' : String(newCount)}            sub="Productos no en catálogo"  icon={Rocket}      color="violet"  />
        <KpiCard label="En catálogo"         value={loading ? '…' : String(existingCount)}       sub="Ya disponibles en tienda"  icon={Package}     color="emerald" />
        <KpiCard label="Categorías"          value={loading ? '…' : String(pieData.length)}      sub="Distintas en este escaneo" icon={Tag}         color="amber"   />
      </div>

      {/* Loading spinner */}
      {loading && (
        <div className="py-20 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Pie chart */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">Por Categoría</h2>
            </div>
            {pieData.length > 0 ? (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-3">
                  {pieData.slice(0, 6).map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-zinc-400 truncate max-w-[120px]">{entry.name}</span>
                      </div>
                      <span className="text-zinc-300 font-mono">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-52 flex items-center justify-center text-zinc-600 text-sm">Sin datos</div>
            )}
          </div>

          {/* Table */}
          <div className="md:col-span-2 p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-violet-400" />
                <h2 className="text-base font-bold text-white">Resultados del Escaneo</h2>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-zinc-900/60 border border-white/10 text-white text-xs rounded-xl pl-8 pr-3 py-2 w-44 outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-zinc-500 uppercase">
                  <tr className="bg-zinc-900/50">
                    <th className="px-4 py-3 rounded-tl-xl">Producto / Marca</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 hidden md:table-cell">Specs clave</th>
                    <th className="px-4 py-3 rounded-tr-xl">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {display.map((row, i) => (
                    <tr key={row.id ?? i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white leading-snug">{row.producto}</p>
                        <p className="text-blue-400 text-xs mt-0.5">{row.marca}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-lg bg-zinc-800/80 border border-white/5 text-zinc-300">
                          {row.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-zinc-500 text-xs max-w-[200px] truncate" title={row.especificaciones_clave}>
                          {row.especificaciones_clave}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {row.estado_db === 'EXISTENTE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Catálogo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <AlertTriangle className="w-3 h-3" /> Novedad
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {display.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-zinc-600 text-sm">
                        {data.length === 0 ? 'Sin ejecuciones previas. Ejecuta el escaneo IA para comenzar.' : 'Sin resultados para el filtro aplicado.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: any;
  color: 'blue' | 'violet' | 'emerald' | 'amber';
}) {
  const styles: Record<string, string> = {
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
  };
  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-zinc-400 leading-tight">{label}</p>
        <div className={cn('p-1.5 rounded-lg border', styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>
      <div className={cn('absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity', styles[color].split(' ')[1])} />
    </div>
  );
}
