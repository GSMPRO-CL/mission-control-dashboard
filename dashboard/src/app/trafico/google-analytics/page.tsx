'use client';

import { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Download,
  Users,
  Activity,
  MousePointerClick,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  PieChart as PieChartIcon
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

interface KpiMetrics {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  conversions: number;
  ecommercePurchases: number;
  purchaseRevenue: number;
  addToCarts: number;
  avgEngagementRate: number;
  avgSessionDuration: number;
}

interface TrendData {
  date: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
}

interface ChannelData {
  channel: string;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
}

interface SourceData {
  sourceMedium: string;
  sessions: number;
  conversions: number;
  revenue: number;
}

interface ApiResponseData {
  kpis: KpiMetrics;
  trend: TrendData[];
  channels: ChannelData[];
  sources: SourceData[];
}

export default function GoogleAnalyticsPage() {
  const [data, setData] = useState<ApiResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trafico/google-analytics?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Error al cargar los datos');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  const formatPercent = (val: number) => `${Number(val * 100).toFixed(2)}%`;

  const handleExportCSV = () => {
    if (!data) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Sesiones,${data.kpis.sessions}\n`
      + `Usuarios Totales,${data.kpis.totalUsers}\n`
      + `Usuarios Nuevos,${data.kpis.newUsers}\n`
      + `Conversiones,${data.kpis.conversions}\n`
      + `Ingresos,${data.kpis.purchaseRevenue}\n`
      + `Tasa de Engagement,${(data.kpis.avgEngagementRate * 100).toFixed(2)}%\n`
      + "\n"
      + "Date,Sessions,Users,Conversions,Revenue\n"
      + data.trend.map(row => {
          return `${row.date},${row.sessions},${row.users},${row.conversions},${row.revenue}`;
      }).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `google_analytics_ga4_${startDate}_${endDate}.csv`);
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Google Analytics 4</h1>
          <p className="text-zinc-400 mt-1">Métricas de tráfico, engagement y conversiones por canales.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
            <CalendarDays className="w-4 h-4 text-zinc-400 ml-2" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
            <span className="text-zinc-500">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-white/5"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Sesiones" 
          value={data ? formatNumber(data.kpis.sessions) : '...'} 
          icon={Activity} 
          color="blue"
          loading={loading}
        />
        <KpiCard 
          title="Usuarios (Nuevos)" 
          value={data ? formatNumber(data.kpis.totalUsers) : '...'} 
          icon={Users} 
          color="emerald"
          loading={loading}
          subtitle={`${data ? formatNumber(data.kpis.newUsers) : '...'} nuevos`}
        />
        <KpiCard 
          title="Ingresos Generados" 
          value={data ? formatCurrency(data.kpis.purchaseRevenue) : '...'} 
          icon={DollarSign} 
          color="amber"
          loading={loading}
          subtitle={`${data ? formatNumber(data.kpis.ecommercePurchases) : '...'} compras`}
        />
        <KpiCard 
          title="Tasa de Engagement" 
          value={data ? formatPercent(data.kpis.avgEngagementRate) : '...'} 
          icon={TrendingUp} 
          color="purple"
          loading={loading}
          subtitle={`Promedio interacción`}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Evolución del Tráfico</h2>
              <p className="text-sm text-zinc-400">Sesiones y Usuarios en el tiempo</p>
            </div>
          </div>
          
          <div className="h-[350px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#52525b" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth()+1}`;
                    }}
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sessions" 
                    name="Sesiones"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSessions)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    name="Usuarios"
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorUsers)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>

        <div className="lg:col-span-1 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl flex flex-col relative overflow-hidden">
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Embudo de Ventas</h2>
              <p className="text-sm text-zinc-400">Tasa de conversión general</p>
            </div>
            {data && (
              <div className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 font-medium">
                {formatPercent(data.kpis.ecommercePurchases / (data.kpis.totalUsers || 1))} CVR
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col justify-center relative z-10 space-y-1">
            
            {/* Step 1: Users */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Usuarios Totales</p>
                  <p className="text-xl font-bold text-white">{data ? formatNumber(data.kpis.totalUsers) : '...'}</p>
                </div>
              </div>
              <div className="w-16 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                 <div className="h-full bg-blue-500 w-full" />
              </div>
            </div>

            {/* Drop-off / Rate 1 */}
            <div className="flex flex-col items-center justify-center -my-2 relative z-20">
               <div className="w-[2px] h-6 bg-white/5" />
               <div className="bg-zinc-950 border border-white/10 text-[10px] uppercase tracking-wider font-bold text-zinc-400 px-3 py-1 rounded-full z-10 shadow-xl flex items-center gap-2">
                  <span>Añaden al carrito:</span>
                  <span className="text-amber-400">{data ? `${((data.kpis.addToCarts / Math.max(data.kpis.totalUsers, 1)) * 100).toFixed(1)}%` : '...'}</span>
               </div>
               <div className="w-[2px] h-6 bg-white/5" />
            </div>

            {/* Step 2: Carts */}
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Añadidos al Carrito</p>
                  <p className="text-xl font-bold text-white">{data ? formatNumber(data.kpis.addToCarts) : '...'}</p>
                </div>
              </div>
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-amber-500 transition-all duration-1000" 
                   style={{ width: data ? `${Math.min(((data.kpis.addToCarts / Math.max(data.kpis.totalUsers, 1)) * 100), 100)}%` : '0%' }}
                 />
              </div>
            </div>

            {/* Drop-off / Rate 2 */}
            <div className="flex flex-col items-center justify-center -my-2 relative z-20">
               <div className="w-[2px] h-6 bg-white/5" />
               <div className="bg-zinc-950 border border-white/10 text-[10px] uppercase tracking-wider font-bold text-zinc-400 px-3 py-1 rounded-full z-10 shadow-xl flex items-center gap-2">
                  <span>Abandono carrito:</span>
                  <span className="text-rose-400">{data ? `${((1 - (data.kpis.ecommercePurchases / Math.max(data.kpis.addToCarts, 1))) * 100).toFixed(1)}%` : '...'}</span>
               </div>
               <div className="w-[2px] h-6 bg-white/5" />
            </div>

            {/* Step 3: Purchases */}
            <div className="bg-zinc-900/50 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between relative overflow-hidden group shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-emerald-400/80 font-medium">Compras Efectivas</p>
                  <p className="text-2xl font-bold text-emerald-400">{data ? formatNumber(data.kpis.ecommercePurchases) : '...'}</p>
                </div>
              </div>
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden relative z-10">
                 <div 
                   className="h-full bg-emerald-500 transition-all duration-1000" 
                   style={{ width: data ? `${Math.min(((data.kpis.ecommercePurchases / Math.max(data.kpis.totalUsers, 1)) * 100), 100)}%` : '0%' }}
                 />
              </div>
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none transition-opacity group-hover:opacity-100 opacity-50" />
            </div>

          </div>
        </div>

      </div>

      {/* Channel & Source Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channels */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <PieChartIcon className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Canales (Default Grouping)</h2>
              <p className="text-sm text-zinc-400">Desglose de sesiones por canal</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.channels.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.channels} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#52525b" fontSize={12} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                  <YAxis type="category" dataKey="channel" stroke="#a1a1aa" fontSize={12} width={100} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: '#27272a' }}
                  />
                  <Bar dataKey="sessions" name="Sesiones" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
        </div>

        {/* Source / Medium */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <MousePointerClick className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Top 15 Source / Medium</h2>
              <p className="text-sm text-zinc-400">Origen y medio del tráfico</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 font-medium">Source / Medium</th>
                  <th className="px-4 py-3 font-medium text-right">Sesiones</th>
                  <th className="px-4 py-3 font-medium text-right">Conversiones</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-3/4" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-1/2 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-1/2 ml-auto" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-white/5 rounded animate-pulse w-1/2 ml-auto" /></td>
                    </tr>
                   ))
                ) : data && data.sources.length > 0 ? (
                  data.sources.map((src, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white truncate max-w-[200px]" title={src.sourceMedium}>
                        {src.sourceMedium}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">{formatNumber(src.sessions)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(src.conversions)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">{formatCurrency(src.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No hay datos de fuente</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}

// KPI Card Component
function KpiCard({ title, value, icon: Icon, color, loading, subtitle }: { title: string, value: string | number, icon: any, color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'zinc', loading?: boolean, subtitle?: string }) {
  const colorStyles = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    zinc: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  };

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl flex flex-col relative overflow-hidden group">
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
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
          </div>
        )}
        {subtitle && !loading && (
          <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>
        )}
      </div>
      {/* Background glow effect */}
      <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500", colorStyles[color].split(' ')[1])} />
    </div>
  );
}
