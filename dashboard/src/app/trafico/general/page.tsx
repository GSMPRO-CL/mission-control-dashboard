'use client';

import { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Download,
  Users,
  Eye,
  Activity,
  MousePointerClick
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn } from '@/lib/utils';

interface KpiMetrics {
  totalSessions: number;
  uniqueVisitors: number;
  totalPageviews: number;
  avgBounceRate: number;
  avgConversionRate: number;
  totalOrders: number;
}

interface TrendData {
  date: string;
  sessions: number;
  visitors: number;
  pageviews: number;
  bounceRate: number;
  orders: number;
  conversionRate: number;
}

interface ApiResponseData {
  kpis: KpiMetrics;
  trend: TrendData[];
}

export default function TraficoGeneralPage() {
  const [data, setData] = useState<ApiResponseData | null>(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const res = await fetch(`/api/trafico/general?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);
  const formatPercent = (val: number) => `${val.toFixed(2)}%`;

  const handleExportCSV = () => {
    if (!data) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Sesiones Totales,${data.kpis.totalSessions}\n`
      + `Visitantes Únicos,${data.kpis.uniqueVisitors}\n`
      + `Páginas Vistas,${data.kpis.totalPageviews}\n`
      + `Tasa de Rebote (Promedio),${data.kpis.avgBounceRate}%\n`
      + `Tasa de Conversión (CVR),${data.kpis.avgConversionRate}%\n`
      + "\n"
      + "Date,Sessions,Visitors,Pageviews,BounceRate,Orders,ConversionRate\n"
      + data.trend.map(row => {
          return `${row.date},${row.sessions},${row.visitors},${row.pageviews},${row.bounceRate.toFixed(2)},${row.orders},${row.conversionRate.toFixed(2)}`;
      }).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trafico_general_${startDate}_${endDate}.csv`);
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Tráfico General (Shopify)</h1>
          <p className="text-zinc-400 mt-1">Métricas globales de adquisición y comportamiento.</p>
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

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard 
          title="Sesiones Totales" 
          value={data ? formatNumber(data.kpis.totalSessions) : '...'} 
          icon={Activity} 
          color="blue"
          loading={loading}
        />
        <KpiCard 
          title="Visitantes Únicos" 
          value={data ? formatNumber(data.kpis.uniqueVisitors) : '...'} 
          icon={Users} 
          color="emerald"
          loading={loading}
        />
        <KpiCard 
          title="Páginas Vistas" 
          value={data ? formatNumber(data.kpis.totalPageviews) : '...'} 
          icon={Eye} 
          color="purple"
          loading={loading}
        />
        <KpiCard 
          title="Tasa de Conversión (CVR)" 
          value={data ? formatPercent(data.kpis.avgConversionRate) : '...'} 
          icon={MousePointerClick} 
          color="amber"
          loading={loading}
          subtitle={`${data ? data.kpis.totalOrders : '...'} órdenes / sesiones`}
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Trend Chart */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Evolución de Tráfico</h2>
              <p className="text-sm text-zinc-400">Sesiones vs Visitantes Diarios</p>
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
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
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
                    dataKey="visitors" 
                    name="Visitantes Únicos"
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorVisitors)" 
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
          <h2 className="text-lg font-bold text-white mb-6 relative z-10">Calidad de Tráfico</h2>
          
          <div className="flex-1 flex flex-col justify-center gap-8 relative z-10">
            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
              <span className="text-zinc-400 text-sm mb-2">Tasa de Rebote (Bounce)</span>
              <span className="text-3xl font-bold text-rose-400">
                {data ? formatPercent(data.kpis.avgBounceRate) : '...'}
              </span>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl" />
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
              <span className="text-zinc-400 text-sm mb-2">Páginas por Sesión</span>
              <span className="text-3xl font-bold text-purple-400">
                {data && data.kpis.totalSessions > 0 
                  ? (data.kpis.totalPageviews / data.kpis.totalSessions).toFixed(2) 
                  : '...'}
              </span>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
            </div>
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
