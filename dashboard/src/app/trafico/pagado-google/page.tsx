'use client';

import { useState, useEffect } from 'react';
import {
  CalendarDays,
  Download,
  MousePointerClick,
  Eye,
  Percent,
  DollarSign,
  Target,
  TrendingUp,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';

/* ── Type Definitions ── */

interface KpiMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
  totalCost: number;
  conversions: number;
  costPerConversion: number;
  conversionsValue: number;
  roas: number;
}

interface TrendData {
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  channelType: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgCpc: number;
  cost: number;
  conversions: number;
  roas: number;
}

interface ApiResponseData {
  dateRange: { startDate: string; endDate: string };
  kpis: KpiMetrics;
  trend: TrendData[];
  campaigns: CampaignData[];
}

/* ── Main Page Component ── */

export default function TraficoGoogleAdsPage() {
  const [data, setData] = useState<ApiResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/google-ads/kpis?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Error al obtener datos de Google Ads');
      }
    } catch (err) {
      console.error('Error fetching Google Ads data:', err);
      setError('No se pudo conectar con la API de Google Ads. Verifica que las credenciales estén configuradas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const formatCurrencyDecimal = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);
  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;
  const formatRoas = (val: number) => `${val.toFixed(2)}x`;

  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = "data:text/csv;charset=utf-8,\n"
      + "=== KPIs Google Ads ===\n"
      + `Impresiones,${data.kpis.impressions}\n`
      + `Clics,${data.kpis.clicks}\n`
      + `CTR,${(data.kpis.ctr * 100).toFixed(2)}%\n`
      + `CPC Promedio,$${data.kpis.avgCpc}\n`
      + `Gasto Total,$${data.kpis.totalCost}\n`
      + `Conversiones,${data.kpis.conversions}\n`
      + `Costo por Conversión,$${data.kpis.costPerConversion}\n`
      + `ROAS,${data.kpis.roas}x\n`
      + "\n=== TENDENCIA DIARIA ===\n"
      + "Fecha,Impresiones,Clics,Gasto,Conversiones\n"
      + data.trend.map(row => `${row.date},${row.impressions},${row.clicks},${row.cost},${row.conversions}`).join("\n")
      + "\n\n=== CAMPAÑAS ===\n"
      + "Campaña,Estado,Canal,Impresiones,Clics,CTR,CPC,Gasto,Conversiones,ROAS\n"
      + data.campaigns.map(c =>
        `"${c.name}",${c.status},${c.channelType},${c.impressions},${c.clicks},${(c.ctr * 100).toFixed(2)}%,$${c.avgCpc.toFixed(2)},$${c.cost.toFixed(2)},${c.conversions},${c.roas.toFixed(2)}x`
      ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `google_ads_kpis_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tráfico Pagado (Google Ads)</h1>
          <p className="text-zinc-400 mt-1">Rendimiento de campañas pagadas y ROAS.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
            <CalendarDays className="w-4 h-4 text-zinc-400 ml-2" />
            <input
              type="date"
              id="gads-start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
            <span className="text-zinc-500">-</span>
            <input
              type="date"
              id="gads-end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
          </div>
          <button
            id="gads-export-csv"
            onClick={handleExportCSV}
            disabled={!data}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Conexión pendiente</p>
            <p className="text-sm text-amber-400/80 mt-1">{error}</p>
            <p className="text-xs text-zinc-500 mt-2">
              Completa las variables <code className="text-zinc-400">GOOGLE_ADS_*</code> en el archivo <code className="text-zinc-400">.env</code> para activar este módulo.
            </p>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Impresiones"
          value={data ? formatNumber(data.kpis.impressions) : '...'}
          icon={Eye}
          color="blue"
          loading={loading}
          subtitle="Veces que se mostró un anuncio"
        />
        <KpiCard
          title="Clics"
          value={data ? formatNumber(data.kpis.clicks) : '...'}
          icon={MousePointerClick}
          color="emerald"
          loading={loading}
          subtitle="Clics en anuncios"
        />
        <KpiCard
          title="CTR"
          value={data ? formatPercent(data.kpis.ctr) : '...'}
          icon={Percent}
          color="amber"
          loading={loading}
          subtitle="Tasa de clics"
        />
        <KpiCard
          title="CPC Promedio"
          value={data ? formatCurrencyDecimal(data.kpis.avgCpc) : '...'}
          icon={DollarSign}
          color="purple"
          loading={loading}
          subtitle="Costo por clic"
        />
        <KpiCard
          title="Gasto Total"
          value={data ? formatCurrency(data.kpis.totalCost) : '...'}
          icon={DollarSign}
          color="rose"
          loading={loading}
          subtitle="Inversión en el periodo"
        />
        <KpiCard
          title="Conversiones"
          value={data ? formatNumber(data.kpis.conversions) : '...'}
          icon={Target}
          color="emerald"
          loading={loading}
          subtitle="Acciones completadas"
        />
        <KpiCard
          title="Costo / Conversión"
          value={data ? formatCurrencyDecimal(data.kpis.costPerConversion) : '...'}
          icon={BarChart3}
          color="indigo"
          loading={loading}
          subtitle="Costo por acción"
        />
        <KpiCard
          title="ROAS"
          value={data ? formatRoas(data.kpis.roas) : '...'}
          icon={TrendingUp}
          color="blue"
          loading={loading}
          subtitle="Retorno sobre inversión"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Trend: Clicks & Cost */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Clics vs Gasto Diario</h2>
              <p className="text-sm text-zinc-400">Evolución diaria del rendimiento</p>
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.trend && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorGadsClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorGadsCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                      return val;
                    }}
                  />
                  <YAxis
                    yAxisId="left"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    formatter={(value: any, name: any) => {
                      if (name === 'cost') return [`$${Number(value).toFixed(2)}`, 'Gasto'];
                      return [formatNumber(Number(value)), name === 'clicks' ? 'Clics' : name];
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="clicks"
                    name="clicks"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorGadsClicks)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost"
                    name="cost"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorGadsCost)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                {error ? 'Esperando conexión con Google Ads' : 'No hay datos para este rango'}
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>

        {/* Trend: Conversions */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Conversiones Diarias</h2>
              <p className="text-sm text-zinc-400">Acciones completadas por día</p>
            </div>
          </div>

          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : data && data.trend && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="date"
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const parts = val.split('-');
                      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                      return val;
                    }}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#10b981' }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                    formatter={(value: any) => [Number(value).toFixed(0), 'Conversiones']}
                  />
                  <Bar
                    dataKey="conversions"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    fillOpacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                {error ? 'Esperando conexión con Google Ads' : 'No hay datos para este rango'}
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
        <h2 className="text-lg font-bold text-white mb-6 relative z-10">Desglose por Campaña</h2>
        <div className="relative z-10 overflow-x-auto">
          {loading ? (
            <div className="w-full h-48 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : data && data.campaigns && data.campaigns.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Campaña</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Impresiones</th>
                  <th className="px-4 py-3 text-right">Clics</th>
                  <th className="px-4 py-3 text-right">CTR</th>
                  <th className="px-4 py-3 text-right">CPC</th>
                  <th className="px-4 py-3 text-right">Gasto</th>
                  <th className="px-4 py-3 text-right">Conv.</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white truncate max-w-[240px]" title={campaign.name}>
                      <div className="flex items-center gap-2">
                        <ChannelBadge type={campaign.channelType} />
                        <span className="truncate">{campaign.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-400">{formatNumber(campaign.impressions)}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{formatNumber(campaign.clicks)}</td>
                    <td className="px-4 py-3 text-right text-amber-400">{formatPercent(campaign.ctr)}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatCurrencyDecimal(campaign.avgCpc)}</td>
                    <td className="px-4 py-3 text-right text-rose-400 font-medium">{formatCurrencyDecimal(campaign.cost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">{campaign.conversions}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        "font-bold",
                        campaign.roas >= 3 ? "text-emerald-400" :
                        campaign.roas >= 1 ? "text-amber-400" :
                        "text-rose-400"
                      )}>
                        {formatRoas(campaign.roas)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="w-full h-48 flex items-center justify-center text-zinc-500">
              {error ? 'Configura las credenciales para ver el desglose de campañas' : 'No hay campañas activas en este periodo'}
            </div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

    </div>
  );
}

/* ── Helper Components ── */

function KpiCard({ title, value, icon: Icon, color, loading, subtitle }: {
  title: string;
  value: string;
  icon: any;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'zinc';
  loading?: boolean;
  subtitle?: string;
}) {
  const colorStyles: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    zinc: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  };

  const bgGlow: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    zinc: 'bg-zinc-500',
  };

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl flex flex-col relative overflow-hidden group hover:shadow-xl transition-all duration-300">
      <div className="flex justify-between items-start relative z-10">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className={cn("p-2 rounded-xl border", colorStyles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4 relative z-10">
        {loading ? (
          <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
        ) : (
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        )}
        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      <div className={cn(
        "absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500",
        bgGlow[color]
      )} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isEnabled = status === 'ENABLED';
  const isPaused = status === 'PAUSED';

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      isEnabled && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      isPaused && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
      !isEnabled && !isPaused && "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        isEnabled && "bg-emerald-400",
        isPaused && "bg-amber-400",
        !isEnabled && !isPaused && "bg-zinc-400"
      )} />
      {isEnabled ? 'Activa' : isPaused ? 'Pausada' : status}
    </span>
  );
}

function ChannelBadge({ type }: { type: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    SEARCH: { label: 'Search', color: 'text-blue-400' },
    DISPLAY: { label: 'Display', color: 'text-purple-400' },
    SHOPPING: { label: 'Shopping', color: 'text-emerald-400' },
    VIDEO: { label: 'Video', color: 'text-rose-400' },
    PERFORMANCE_MAX: { label: 'PMax', color: 'text-amber-400' },
    DEMAND_GEN: { label: 'DGen', color: 'text-indigo-400' },
  };

  const info = labels[type] || { label: type, color: 'text-zinc-400' };

  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5", info.color)}>
      {info.label}
    </span>
  );
}
