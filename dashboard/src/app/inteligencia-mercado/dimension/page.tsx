"use client";

import { useState, useEffect } from 'react';
import { Globe, TrendingUp, ShoppingBag, BarChart2, RefreshCw, Clock, Search, Calculator, AlertTriangle } from 'lucide-react';
import {
  Treemap,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

interface GlobalMetrics {
  totalMarketSizeAvg: number;
  totalMarketSizeLast: number;
  totalShareAvg: number;
  totalShareLast: number;
  productCount: number;
}

interface ProductMetric {
  product_id: number;
  product_title: string;
  vendor: string;
  keyword: string;
  avg_price: number;
  avg_monthly_searches: number;
  last_month_searches: number;
  market_size_avg: number;
  market_size_last: number;
  market_share_avg: number;
  market_share_last: number;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const formatNumber = (n: number) =>
  new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(n);

// Custom TreeMap content for better labels
const CustomTreemapContent = ({ x, y, width, height, name, value }: any) => {
  if (!width || !height || width < 40 || height < 30) return null;
  const fontSize = Math.min(12, Math.max(8, width / 12));
  return (
    <g>
      <rect
        x={x} y={y} width={width} height={height}
        style={{ fill: `hsl(${210 + (value % 60)}, 70%, ${25 + (value % 20)}%)`, stroke: '#18181b', strokeWidth: 2 }}
        rx={4}
      />
      <foreignObject x={x + 4} y={y + 4} width={width - 8} height={height - 8}>
        <div style={{ overflow: 'hidden', color: '#fff', fontSize: `${fontSize}px`, lineHeight: '1.2', fontWeight: 500 }}>
          <div style={{ marginBottom: 2 }}>{name}</div>
          <div style={{ opacity: 0.7, fontSize: `${fontSize - 1}px` }}>{formatCurrency(value)}</div>
        </div>
      </foreignObject>
    </g>
  );
};

export default function DimensionMercadoPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [globals, setGlobals] = useState<GlobalMetrics | null>(null);
  const [products, setProducts] = useState<ProductMetric[]>([]);
  const [view, setView] = useState<'treemap' | 'ranking'>('ranking');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchData();
  }, [mounted]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inteligencia-mercado/dimension');
      const json = await res.json();
      if (json.success && json.data.globals.productCount > 0) {
        setGlobals(json.data.globals);
        setProducts(json.data.products);
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

  // Prepare treemap data (top 50 by market size)
  const treemapData = products.slice(0, 50).map(p => ({
    name: p.product_title.length > 30 ? p.product_title.slice(0, 27) + '...' : p.product_title,
    fullName: p.product_title,
    value: p.market_size_avg,
    vendor: p.vendor,
    keyword: p.keyword,
    searches: p.avg_monthly_searches,
  }));

  // Top 15 by market size for bar chart
  const top15 = products.slice(0, 15).map(p => ({
    name: p.product_title.length > 25 ? p.product_title.slice(0, 22) + '...' : p.product_title,
    fullName: p.product_title,
    marketSize: p.market_size_avg,
    marketShare: p.market_share_avg,
    searches: p.avg_monthly_searches,
  }));

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dimensión de Mercado</h1>
          <p className="text-zinc-400 mt-1">
            Market Size y Market Share estimados a partir de volúmenes de búsqueda (Google Ads).
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

      {/* KPI Cards Globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Market Size Promedio"
          value={loading ? "..." : globals ? formatCurrency(globals.totalMarketSizeAvg) : "Sin datos"}
          subtitle="Tamaño total del mercado"
          icon={Globe}
          color="blue"
        />
        <KpiCard
          title="Market Size Último Mes"
          value={loading ? "..." : globals ? formatCurrency(globals.totalMarketSizeLast) : "Sin datos"}
          subtitle="Tamaño estimado del mes actual"
          icon={TrendingUp}
          color="violet"
        />
        <KpiCard
          title="Market Share Promedio"
          value={loading ? "..." : globals ? formatCurrency(globals.totalShareAvg) : "Sin datos"}
          subtitle="Nuestra cuota estimada (5%)"
          icon={ShoppingBag}
          color="emerald"
        />
        <KpiCard
          title="Productos Analizados"
          value={loading ? "..." : globals ? formatNumber(globals.productCount) : "0"}
          subtitle="Productos activos con datos"
          icon={BarChart2}
          color="amber"
        />
      </div>

      {/* Chart Section */}
      {noData ? (
        <PendingState />
      ) : (
        <>
          {/* View Toggle + Chart */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
            {/* Toggle */}
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div>
                <h2 className="text-lg font-bold text-white">Mapa de Mercado por Producto</h2>
                <p className="text-xs text-zinc-400 mt-1">Área proporcional al Market Size estimado</p>
              </div>
              <div className="flex bg-zinc-900/60 border border-white/10 rounded-xl p-1 gap-1">
                <button
                  onClick={() => setView('ranking')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    view === 'ranking' ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white")}
                >
                  Ranking
                </button>
                <button
                  onClick={() => setView('treemap')}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    view === 'treemap' ? "bg-blue-600 text-white" : "text-zinc-400 hover:text-white")}
                >
                  Treemap
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-[400px] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : view === 'treemap' ? (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="value"
                    aspectRatio={4 / 3}
                    content={<CustomTreemapContent />}
                  >
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any, _: any, props: any) => [
                        formatCurrency(val),
                        `${props.payload?.fullName || ''} | Búsquedas: ${formatNumber(props.payload?.searches || 0)}`
                      ]}
                    />
                  </Treemap>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top15} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <XAxis type="number" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} width={140} />
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={true} horizontal={false} />
                    <RechartsTooltip
                      cursor={{ fill: '#27272a', opacity: 0.4 }}
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', color: '#fff', fontSize: '12px' }}
                      formatter={(val: any, key: any) => [
                        formatCurrency(val),
                        key === 'marketSize' ? 'Market Size Promedio' : 'Market Share Estimado'
                      ]}
                      labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="marketSize" name="Market Size" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
                    <Bar dataKey="marketShare" name="Market Share" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Products Table */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
            <h2 className="text-lg font-bold text-white mb-5">Detalle por Producto</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase">
                  <tr className="bg-zinc-900/50 rounded-lg">
                    <th className="px-4 py-3 rounded-tl-lg">#</th>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3 text-right">Vol. Prom./mes</th>
                    <th className="px-4 py-3 text-right">Market Size Prom.</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Market Share Est.</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.product_id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-xs leading-tight max-w-[220px]">{p.product_title}</div>
                        <div className="text-zinc-500 text-[10px] mt-0.5">{p.vendor}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-lg px-2 py-0.5 text-[10px] font-mono">
                          {p.keyword}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                        {formatNumber(p.avg_monthly_searches)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-400 font-medium text-xs">
                        {formatCurrency(p.market_size_avg)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium text-xs">
                        {formatCurrency(p.market_share_avg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

// ─── Pending State Component ──────────────────────────────────────────────────

function PendingState() {
  const [keyword, setKeyword]     = useState('');
  const [price, setPrice]         = useState('');
  const [searches, setSearches]   = useState('');
  const [preview, setPreview]     = useState<{ marketSize: number; marketShare: number; buyers: number } | null>(null);

  const calculate = (e: React.FormEvent) => {
    e.preventDefault();
    const vol = parseFloat(searches);
    const prc = parseFloat(price);
    if (!vol || !prc) return;
    const buyers     = vol * 0.01;
    const marketSize = buyers * prc;
    const marketShare = marketSize * 0.05;
    setPreview({ marketSize, marketShare, buyers });
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="flex items-start gap-4 p-5 rounded-2xl border border-amber-500/30 bg-amber-500/5">
        <div className="p-2 rounded-xl bg-amber-500/10 flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <p className="text-amber-400 font-semibold">Esperando Google Ads Basic Access</p>
          <p className="text-zinc-400 text-sm mt-1">
            El servicio <code className="text-xs bg-zinc-900 px-1.5 py-0.5 rounded text-blue-300">KeywordPlanIdeaService</code> requiere aprobación de Basic Access.
            Puedes usar la calculadora abajo para estimar el mercado manualmente mientras tanto.
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Solicitado en ads.google.com
            </span>
            <span className="text-[10px] text-zinc-600">1-5 días hábiles · El token nuevo llegará por email</span>
          </div>
        </div>
      </div>

      {/* Formula explainer */}
      <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
        <h2 className="text-lg font-bold text-white mb-1">Cómo se calcula el Market Size</h2>
        <p className="text-zinc-500 text-sm mb-5">La fórmula que usará este módulo cuando Google Ads esté activo:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {[
            { step: '1', label: 'Compradores potenciales', formula: 'Búsquedas/mes × 1%', color: 'blue' },
            { step: '2', label: 'Market Size',             formula: 'Compradores × Precio promedio', color: 'violet' },
            { step: '3', label: 'Market Share estimado',   formula: 'Market Size × 5%', color: 'emerald' },
          ].map(item => (
            <div key={item.step} className="p-4 rounded-2xl border border-white/5 bg-zinc-900/40">
              <span className="text-[10px] font-mono text-zinc-600">PASO {item.step}</span>
              <p className="text-white font-semibold mt-1">{item.label}</p>
              <p className="text-xs font-mono text-zinc-400 mt-1">{item.formula}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Manual calculator */}
      <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-5">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Calculadora Manual</h2>
        </div>
        <form onSubmit={calculate} className="flex flex-col md:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder='Keyword (ej. "iPhone 15 case")'
              className="w-full bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>
          <input
            type="number"
            value={searches}
            onChange={e => setSearches(e.target.value)}
            placeholder="Búsquedas/mes"
            className="w-full md:w-44 bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Precio USD"
            className="w-full md:w-36 bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!searches || !price}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
          >
            <Calculator className="w-4 h-4" />
            Calcular
          </button>
        </form>

        {preview && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-center">
              <p className="text-xs text-zinc-500 mb-1">Compradores Potenciales</p>
              <p className="text-2xl font-bold text-white">{preview.buyers.toLocaleString('es-CL', { maximumFractionDigits: 0 })}</p>
              <p className="text-[10px] text-zinc-600 mt-1">personas/mes</p>
            </div>
            <div className="p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-center">
              <p className="text-xs text-zinc-500 mb-1">Market Size Estimado</p>
              <p className="text-2xl font-bold text-white">{fmtCurrency(preview.marketSize)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">tamaño del mercado</p>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <p className="text-xs text-zinc-500 mb-1">Market Share Estimado</p>
              <p className="text-2xl font-bold text-white">{fmtCurrency(preview.marketShare)}</p>
              <p className="text-[10px] text-zinc-600 mt-1">nuestra cuota (5%)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle: string; icon: any;
  color: 'blue' | 'violet' | 'emerald' | 'amber';
}) {
  const styles = {
    blue:    'text-blue-400   bg-blue-500/10   border-blue-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
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
