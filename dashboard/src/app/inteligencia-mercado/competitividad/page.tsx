"use client";

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  TrendingDown, 
  TrendingUp, 
  PackageX,
  RefreshCw,
  Store,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Summary {
  totalComparisons: number;
  uniqueProducts: number;
  competitivenessRate: number;
  avgPriceDiffPct: number;
  inStockCompetitors: number;
  outOfStockCompetitors: number;
  lastSync: string | null;
}

interface CompetitorRow {
  product_id: number;
  product_title: string;
  vendor: string;
  our_price: number;
  competitor_name: string;
  competitor_title: string;
  competitor_price: number;
  has_stock: boolean;
  competitor_url: string;
  price_diff_amount: number;
  price_diff_pct: number;
  is_competitive: boolean;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export default function CompetitividadPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    fetchData();
  }, [mounted]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/inteligencia-mercado/competitividad');
      const json = await res.json();
      if (json.success && json.data.summary.totalComparisons > 0) {
        setSummary(json.data.summary);
        setCompetitors(json.data.competitors);
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

  const filtered = competitors.filter(c =>
    !search ||
    c.product_title.toLowerCase().includes(search.toLowerCase()) ||
    c.competitor_name.toLowerCase().includes(search.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Competitividad</h1>
          <p className="text-zinc-400 mt-1">
            Monitor de precios de la competencia vía Google Shopping (SerpApi).
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Índice de Competitividad"
          value={loading ? "..." : summary ? `${summary.competitivenessRate}%` : "—"}
          subtitle="% comparaciones donde somos ≤ al competidor"
          icon={ShieldCheck}
          color={summary && summary.competitivenessRate >= 50 ? "emerald" : "rose"}
        />
        <KpiCard
          title="Diferencia Promedio"
          value={loading ? "..." : summary ? `${summary.avgPriceDiffPct > 0 ? '+' : ''}${summary.avgPriceDiffPct}%` : "—"}
          subtitle="Diferencial de precio vs competidores"
          icon={summary && summary.avgPriceDiffPct >= 0 ? TrendingUp : TrendingDown}
          color={summary && summary.avgPriceDiffPct >= 0 ? "blue" : "amber"}
        />
        <KpiCard
          title="Competidores con Stock"
          value={loading ? "..." : summary ? String(summary.inStockCompetitors) : "—"}
          subtitle="Competidores activos en el mercado"
          icon={Store}
          color="blue"
        />
        <KpiCard
          title="Sin Stock (Competidores)"
          value={loading ? "..." : summary ? String(summary.outOfStockCompetitors) : "—"}
          subtitle="Oportunidades por falta de stock rival"
          icon={PackageX}
          color="violet"
        />
      </div>

      {noData ? (
        <div className="p-12 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <ShieldCheck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin datos de competidores todavía</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto mb-3">
            Ejecuta el sincronizador para poblar los datos. Requiere créditos en SerpApi.
          </p>
          <code className="block text-xs text-blue-400 bg-zinc-900 rounded-lg px-4 py-2 inline-block">
            cd scripts && node sync-competitor-prices.js --limit=10
          </code>
        </div>
      ) : (
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
          {/* Header + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">Comparativa de Precios</h2>
              {summary?.lastSync && (
                <p className="text-xs text-zinc-500 mt-0.5">Última actualización: {summary.lastSync}</p>
              )}
            </div>
            <input
              type="text"
              placeholder="Buscar producto o competidor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-900/60 border border-white/10 text-white text-sm rounded-xl px-4 py-2 w-full sm:w-72 outline-none focus:border-blue-500/50 transition-colors placeholder:text-zinc-600"
            />
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase">
                  <tr className="bg-zinc-900/50">
                    <th className="px-4 py-3 rounded-tl-lg">Nuestro Producto</th>
                    <th className="px-4 py-3">Competidor</th>
                    <th className="px-4 py-3 text-right">Nuestro Precio</th>
                    <th className="px-4 py-3 text-right">Precio Rival</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-center">Stock Rival</th>
                    <th className="px-4 py-3 text-center rounded-tr-lg">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white text-xs leading-tight max-w-[180px]">{row.product_title}</div>
                        <div className="text-zinc-500 text-[10px] mt-0.5">{row.vendor}</div>
                      </td>
                      <td className="px-4 py-3">
                        {row.competitor_url ? (
                          <a
                            href={row.competitor_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium underline underline-offset-2 transition-colors"
                          >
                            {row.competitor_name}
                          </a>
                        ) : (
                          <span className="text-zinc-300 text-xs">{row.competitor_name}</span>
                        )}
                        <div className="text-zinc-500 text-[10px] mt-0.5 max-w-[150px] leading-tight">{row.competitor_title}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono text-xs">
                        {formatCurrency(row.our_price)}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300 font-mono text-xs">
                        {formatCurrency(row.competitor_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-mono text-xs font-medium",
                          row.price_diff_pct > 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {row.price_diff_pct > 0 ? '+' : ''}{row.price_diff_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.has_stock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-400 border border-white/10 rounded-full px-2 py-0.5">
                            <AlertCircle className="w-2.5 h-2.5" />
                            Agotado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_competitive ? (
                          <span className="inline-block text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5">
                            Competitivo
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full px-2 py-0.5">
                            Más caro
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">No hay resultados para tu búsqueda.</div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle: string; icon: any;
  color: 'emerald' | 'rose' | 'blue' | 'amber' | 'violet';
}) {
  const styles = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose:    'text-rose-400    bg-rose-500/10    border-rose-500/20',
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
    violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20',
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
