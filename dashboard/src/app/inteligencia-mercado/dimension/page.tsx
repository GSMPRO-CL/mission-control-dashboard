"use client";

import { useState, useEffect } from 'react';
import { Globe, TrendingUp, ShoppingBag, BarChart2, RefreshCw } from 'lucide-react';
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
        <div className="p-12 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <Globe className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin datos de mercado todavía</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Ejecuta el sincronizador para poblar los datos:
          </p>
          <code className="block mt-3 text-xs text-blue-400 bg-zinc-900 rounded-lg px-4 py-2 inline-block">
            cd scripts && node sync-market-size.js
          </code>
        </div>
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
