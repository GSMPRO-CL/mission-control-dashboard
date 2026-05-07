"use client";

import { useState, useEffect } from 'react';
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle,
  BarChart2, RefreshCw, Activity
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Summary {
  breakouts: number;
  rising: number;
  atRisk: number;
  totalBrands: number;
  avgIndex: number;
}

interface SignalRow {
  keyword: string;
  signal: 'breakout' | 'rising' | 'stable' | 'falling' | 'risk';
  signal_detail: string;
  latest_value: number;
  vendor_products: number;
  last_date: string;
}

type TimelineMap = Record<string, Array<{ date: string; value: number }>>;

// ─── Colores y estilos por señal ─────────────────────────────────────────────
const SIGNAL_CONFIG = {
  breakout: { label: 'Breakout 🚀',  icon: Zap,           bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400' },
  rising:   { label: 'Al alza ↑',    icon: TrendingUp,    bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  stable:   { label: 'Estable',      icon: Activity,      bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400' },
  falling:  { label: 'A la baja ↓',  icon: TrendingDown,  bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  risk:     { label: 'En riesgo ⚠️', icon: AlertTriangle, bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   text: 'text-rose-400' },
};

// Paleta de colores para el gráfico de líneas (hasta 10 marcas)
const LINE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function TendenciasPage() {
  const [mounted, setMounted]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [noData, setNoData]       = useState(false);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [signals, setSignals]     = useState<SignalRow[]>([]);
  const [timeline, setTimeline]   = useState<TimelineMap>({});
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) fetchData(); }, [mounted]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/inteligencia-mercado/tendencias');
      const json = await res.json();
      if (json.success && json.data.summary.totalBrands > 0) {
        setSummary(json.data.summary);
        setSignals(json.data.signals);
        setTimeline(json.data.timeline);
        // Pre-seleccionar las 5 marcas con señal más urgente para el gráfico
        const top5 = json.data.signals.slice(0, 5).map((s: SignalRow) => s.keyword);
        setSelectedBrands(top5);
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

  // Construir datos del gráfico de líneas combinando fechas de todas las marcas seleccionadas
  const chartData = (() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const brand of selectedBrands) {
      for (const point of (timeline[brand] || [])) {
        if (!dateMap.has(point.date)) dateMap.set(point.date, {});
        dateMap.get(point.date)![brand] = point.value;
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date: date.slice(5), ...values })); // "2024-04-01" → "04-01"
  })();

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand].slice(0, 10) // máx 10 en el gráfico
    );
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tendencias de Mercado</h1>
          <p className="text-zinc-400 mt-1">
            Índice de interés 0-100 por marca (Google Trends) con alertas de oportunidad y riesgo.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Actualizar
        </button>
      </div>

      {/* KPIs Globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Breakouts" value={loading ? "..." : String(summary?.breakouts ?? 0)}
          subtitle="Marcas en demanda explosiva" icon={Zap} color="amber" />
        <KpiCard title="En Alza" value={loading ? "..." : String(summary?.rising ?? 0)}
          subtitle="Marcas con tendencia positiva" icon={TrendingUp} color="emerald" />
        <KpiCard title="En Riesgo" value={loading ? "..." : String(summary?.atRisk ?? 0)}
          subtitle="Marcas con baja demanda" icon={AlertTriangle} color="rose" />
        <KpiCard title="Índice Promedio" value={loading ? "..." : `${summary?.avgIndex ?? 0}/100`}
          subtitle={`De ${summary?.totalBrands ?? 0} marcas analizadas`} icon={BarChart2} color="blue" />
      </div>

      {noData ? (
        <div className="p-12 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <Activity className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin datos de tendencias todavía</h3>
          <p className="text-zinc-400 text-sm mb-3">
            Ejecuta el sincronizador. Requiere créditos en SerpApi (mismo plan que Competitividad).
          </p>
          <code className="block text-xs text-blue-400 bg-zinc-900 rounded-lg px-4 py-2 inline-block">
            cd scripts && node sync-market-trends.js --top=10 --dry-run
          </code>
        </div>
      ) : (
        <>
          {/* Gráfico de Líneas */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-white">Evolución de Interés por Marca</h2>
                <p className="text-xs text-zinc-400 mt-1">Selecciona hasta 10 marcas para comparar</p>
              </div>
            </div>
            {/* Brand toggles */}
            <div className="flex flex-wrap gap-2 mb-6">
              {signals.map((s, i) => (
                <button
                  key={s.keyword}
                  onClick={() => toggleBrand(s.keyword)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    selectedBrands.includes(s.keyword)
                      ? "text-white border-transparent"
                      : "text-zinc-500 border-white/10 hover:text-zinc-300"
                  )}
                  style={selectedBrands.includes(s.keyword)
                    ? { backgroundColor: LINE_COLORS[selectedBrands.indexOf(s.keyword)] + '33',
                        borderColor:      LINE_COLORS[selectedBrands.indexOf(s.keyword)] + '66',
                        color:            LINE_COLORS[selectedBrands.indexOf(s.keyword)] }
                    : {}}
                >
                  {s.keyword}
                </button>
              ))}
            </div>
            <div className="h-[300px]">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
                    {selectedBrands.map((brand, i) => (
                      <Line
                        key={brand}
                        type="monotone"
                        dataKey={brand}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Tarjetas de Señales */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">Alertas por Marca</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {signals.map(row => {
                const cfg = SIGNAL_CONFIG[row.signal] ?? SIGNAL_CONFIG.stable;
                const Icon = cfg.icon;
                return (
                  <div key={row.keyword} className={cn(
                    "p-5 rounded-2xl border backdrop-blur-xl relative overflow-hidden group",
                    cfg.bg, cfg.border
                  )}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">{row.keyword}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{row.vendor_products} productos activos</p>
                      </div>
                      <div className={cn("p-1.5 rounded-lg", cfg.bg, cfg.border, "border")}>
                        <Icon className={cn("w-4 h-4", cfg.text)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", cfg.bg, cfg.border, cfg.text)}>
                        {cfg.label}
                      </span>
                      <span className="text-zinc-400 text-xs font-mono">
                        {row.latest_value}/100
                      </span>
                    </div>
                    <p className="text-zinc-300 text-xs leading-relaxed">{row.signal_detail}</p>
                  </div>
                );
              })}
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
  color: 'amber' | 'emerald' | 'rose' | 'blue';
}) {
  const styles = {
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose:    'text-rose-400    bg-rose-500/10    border-rose-500/20',
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
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
