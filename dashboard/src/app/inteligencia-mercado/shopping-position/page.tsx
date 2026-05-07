"use client";

import { useState, useEffect } from 'react';
import {
  Target, Eye, TrendingUp, Clock,
  RefreshCw, ShoppingCart, Award
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AdType = 'paid' | 'organic';

interface Summary {
  totalKeywords: number;
  appeared: number;
  visibilityRate: number;
  avgPosition: number | null;
  lastScan: string | null;
}

interface Competitor {
  rank: number;
  name: string;
  title: string;
  price: string | null;
  is_exact_match: boolean;
}

interface KeywordRow {
  keyword: string;
  gsmpro_position: number | null;
  gsmpro_appeared: boolean;
  gsmpro_price: string | null;
  competitors: Competitor[];
}

interface HistoryPoint {
  label: string;
  avgPosition: number | null;
  keywordsVisible: number;
  totalKeywords: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function PositionBadge({ pos }: { pos: number | null }) {
  if (pos === null) {
    return (
      <span className="inline-block text-[10px] bg-zinc-800 text-zinc-400 border border-white/10 rounded-full px-2 py-0.5">
        No aparece
      </span>
    );
  }
  const colors: Record<number, string> = {
    1: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    2: 'bg-zinc-400/20 text-zinc-300 border-zinc-400/40',
    3: 'bg-orange-700/20 text-orange-400 border-orange-700/40',
  };
  const cls = colors[pos] ?? 'bg-blue-500/10 text-blue-300 border-blue-500/20';
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-mono font-bold border rounded-full px-2 py-0.5", cls)}>
      {pos === 1 && <Award className="w-2.5 h-2.5" />}#{pos}
    </span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function ShoppingPositionPage() {
  const [mounted, setMounted]   = useState(false);
  const [adType, setAdType]     = useState<AdType>('paid');
  const [loading, setLoading]   = useState(true);
  const [noData, setNoData]     = useState(false);
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [history, setHistory]   = useState<HistoryPoint[]>([]);
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) fetchData(adType); }, [mounted, adType]);

  const fetchData = async (type: AdType) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/inteligencia-mercado/shopping-position?adType=${type}`);
      const json = await res.json();
      if (json.success && json.data.summary.totalKeywords > 0) {
        setSummary(json.data.summary);
        setKeywords(json.data.keywords);
        setHistory(json.data.history);
        setNoData(false);
      } else {
        setNoData(true);
      }
    } catch (err) {
      console.error(err);
      setNoData(true);
    } finally {
      setLoading(false);
    }
  };

  const filtered = keywords.filter(k =>
    !search || k.keyword.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header + Switch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Posicionamiento Shopping</h1>
          <p className="text-zinc-400 mt-1">
            Ranking de GSMPRO en Google Shopping por keyword. Escaneo 3x diario.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Switch Pagado / Orgánico */}
          <div className="flex bg-zinc-900/60 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setAdType('paid')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                adType === 'paid'
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <ShoppingCart className="w-3 h-3" />
              Pagado
            </button>
            <button
              onClick={() => setAdType('organic')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
                adType === 'organic'
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <TrendingUp className="w-3 h-3" />
              Orgánico
            </button>
          </div>
          <button
            onClick={() => fetchData(adType)}
            disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Keywords Monitoreadas" value={loading ? "..." : String(summary?.totalKeywords ?? 0)}
          subtitle="Total en nuestro catálogo" icon={Target} color="blue" />
        <KpiCard title="Tasa de Visibilidad" value={loading ? "..." : `${summary?.visibilityRate ?? 0}%`}
          subtitle="Keywords donde aparecemos" icon={Eye} color="emerald" />
        <KpiCard title="Posición Promedio" value={loading ? "..." : summary?.avgPosition != null ? `#${summary.avgPosition}` : "—"}
          subtitle="Avg. en resultados activos" icon={Award} color="amber" />
        <KpiCard title="Último Escaneo" value={loading ? "..." : summary?.lastScan?.split(' ')[1] ?? "—"}
          subtitle={summary?.lastScan?.split(' ')[0] ?? "Sin datos"} icon={Clock} color="violet" />
      </div>

      {noData ? (
        <div className="p-12 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <Target className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin datos de posicionamiento todavía</h3>
          <p className="text-zinc-400 text-sm mb-1">El Cloud Run Job debe ejecutarse al menos una vez.</p>
          <p className="text-zinc-500 text-xs">Horario: Orgánico 07:00/12:00/17:00 — Pagado 08:00/13:00/18:00 (America/Santiago)</p>
        </div>
      ) : (
        <>
          {/* Gráfico Histórico */}
          {history.length > 1 && (
            <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
              <h2 className="text-lg font-bold text-white mb-1">Evolución de Posición Promedio</h2>
              <p className="text-xs text-zinc-400 mb-6">
                Modo: <span className={cn("font-semibold", adType === 'paid' ? 'text-blue-400' : 'text-emerald-400')}>
                  {adType === 'paid' ? 'Pagado' : 'Orgánico'}
                </span>
              </p>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" stroke="#52525b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} reversed domain={[1, 'auto']} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                      formatter={(v: any) => [`#${v}`, 'Posición Promedio']}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgPosition"
                      stroke={adType === 'paid' ? '#3b82f6' : '#10b981'}
                      strokeWidth={2}
                      dot={{ r: 3, fill: adType === 'paid' ? '#3b82f6' : '#10b981' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </div>
          )}

          {/* Tabla de Keywords */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-bold text-white">Posición por Keyword</h2>
              <input
                type="text"
                placeholder="Buscar keyword..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-zinc-900/60 border border-white/10 text-white text-sm rounded-xl px-4 py-2 w-full sm:w-64 outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
              />
            </div>

            <div className="space-y-2">
              {filtered.map(row => (
                <div key={row.keyword} className="border border-white/5 rounded-2xl overflow-hidden">
                  {/* Fila principal */}
                  <button
                    onClick={() => setExpanded(expanded === row.keyword ? null : row.keyword)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <PositionBadge pos={row.gsmpro_position} />
                      <span className="text-white text-sm font-medium">{row.keyword}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {row.gsmpro_price && (
                        <span className="text-zinc-400 text-xs font-mono">{row.gsmpro_price}</span>
                      )}
                      <span className="text-zinc-600 text-xs">
                        {row.competitors.length} competidores ›
                      </span>
                    </div>
                  </button>
                  {/* Detalle de competidores (expandible) */}
                  {expanded === row.keyword && row.competitors.length > 0 && (
                    <div className="border-t border-white/5 bg-zinc-900/30 px-4 py-3">
                      <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Top competidores</p>
                      <div className="space-y-1.5">
                        {row.competitors.map(comp => (
                          <div key={comp.rank} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 font-mono w-4">#{comp.rank}</span>
                              <span className={cn("font-medium", comp.is_exact_match ? "text-zinc-200" : "text-zinc-500")}>
                                {comp.name}
                              </span>
                              {!comp.is_exact_match && (
                                <span className="text-amber-500/70 text-[9px]">⚠️ falso positivo</span>
                              )}
                            </div>
                            <span className="text-zinc-400 font-mono">{comp.price ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">No hay keywords que coincidan.</div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle: string; icon: any;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const styles = {
    blue:    'text-blue-400   bg-blue-500/10   border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
  };
  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3 relative z-10">
        <p className="text-xs font-medium text-zinc-400 leading-tight">{title}</p>
        <div className={cn("p-1.5 rounded-lg border", styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight relative z-10">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1 relative z-10">{subtitle}</p>
      <div className={cn("absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity", styles[color].split(' ')[1])} />
    </div>
  );
}
