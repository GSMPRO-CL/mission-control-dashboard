'use client';

import { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Download,
  MousePointerClick,
  Eye,
  Percent,
  Search
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
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TrendData {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface QueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface PageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface ApiResponseData {
  kpis: KpiMetrics;
  trend: TrendData[];
  topQueries: QueryData[];
  topPages: PageData[];
}

export default function TraficoOrganicoPage() {
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
      const res = await fetch(`/api/trafico/organico?startDate=${startDate}&endDate=${endDate}`);
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
  const formatPos = (val: number) => val.toFixed(1);

  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = "data:text/csv;charset=utf-8,\n" 
      + "=== KPIS ===\n"
      + `Clics,${data.kpis.clicks}\n`
      + `Impresiones,${data.kpis.impressions}\n`
      + `CTR Promedio,${data.kpis.ctr}%\n`
      + `Posición Promedio,${data.kpis.position}\n`
      + "\n=== TREND ===\n"
      + "Date,Clicks,Impressions,CTR,Position\n"
      + data.trend.map(row => `${row.date},${row.clicks},${row.impressions},${row.ctr.toFixed(2)},${row.position.toFixed(1)}`).join("\n")
      + "\n\n=== TOP QUERIES ===\n"
      + "Query,Clicks,Impressions,CTR,Position\n"
      + data.topQueries.slice(0, 50).map(row => `"${row.query.replace(/"/g, '""')}",${row.clicks},${row.impressions},${row.ctr.toFixed(2)},${row.position.toFixed(1)}`).join("\n")
      + "\n\n=== TOP PAGES ===\n"
      + "Page,Clicks,Impressions,CTR,Position\n"
      + data.topPages.slice(0, 50).map(row => `"${row.page.replace(/"/g, '""')}",${row.clicks},${row.impressions},${row.ctr.toFixed(2)},${row.position.toFixed(1)}`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trafico_organico_${startDate}_${endDate}.csv`);
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Tráfico Orgánico (SEO)</h1>
          <p className="text-zinc-400 mt-1">Rendimiento en motores de búsqueda vía Google Search Console.</p>
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
          title="Clics Totales" 
          value={data ? formatNumber(data.kpis.clicks) : '...'} 
          icon={MousePointerClick} 
          color="blue"
          loading={loading}
        />
        <KpiCard 
          title="Impresiones Totales" 
          value={data ? formatNumber(data.kpis.impressions) : '...'} 
          icon={Eye} 
          color="emerald"
          loading={loading}
        />
        <KpiCard 
          title="CTR Promedio" 
          value={data ? formatPercent(data.kpis.ctr) : '...'} 
          icon={Percent} 
          color="amber"
          loading={loading}
        />
        <KpiCard 
          title="Posición Promedio" 
          value={data ? formatPos(data.kpis.position) : '...'} 
          icon={Search} 
          color="purple"
          loading={loading}
        />
      </div>

      {/* Trend Chart */}
      <div className="w-full p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Evolución de Clics vs Impresiones</h2>
            <p className="text-sm text-zinc-400">Rendimiento diario orgánico</p>
          </div>
        </div>
        
        <div className="h-[350px] w-full relative z-10">
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          ) : data && data.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
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
                  yAxisId="left"
                  stroke="#52525b" 
                  fontSize={12} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
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
                  yAxisId="right"
                  type="monotone" 
                  dataKey="impressions" 
                  name="Impresiones"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorImpressions)" 
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="clicks" 
                  name="Clics"
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorClicks)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos</div>
          )}
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Queries Table */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6 relative z-10">Top Consultas (Keywords)</h2>
          <div className="relative z-10 overflow-x-auto">
            {loading ? (
              <div className="w-full h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : data && data.topQueries && data.topQueries.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Keyword</th>
                    <th className="px-4 py-3 text-right">Clics</th>
                    <th className="px-4 py-3 text-right">Impresiones</th>
                    <th className="px-4 py-3 text-right">Pos.</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topQueries.slice(0, 50).map((q, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-blue-400 truncate max-w-[200px]" title={q.query}>
                        {q.query}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">{formatNumber(q.clicks)}</td>
                      <td className="px-4 py-3 text-right text-zinc-400">{formatNumber(q.impressions)}</td>
                      <td className="px-4 py-3 text-right text-purple-400">{formatPos(q.position)}</td>
                      <td className="px-4 py-3 text-right text-amber-400">{formatPercent(q.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
        </div>

        {/* Top Pages Table */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6 relative z-10">Top Páginas de Aterrizaje</h2>
          <div className="relative z-10 overflow-x-auto">
            {loading ? (
              <div className="w-full h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.topPages && data.topPages.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">URL</th>
                    <th className="px-4 py-3 text-right">Clics</th>
                    <th className="px-4 py-3 text-right">Pos.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPages.slice(0, 50).map((p, i) => {
                    const shortUrl = p.page.replace('https://gsmpro.cl', '').replace('https://www.gsmpro.cl', '');
                    return (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-200 truncate max-w-[280px]" title={p.page}>
                          {shortUrl}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-white">{formatNumber(p.clicks)}</td>
                        <td className="px-4 py-3 text-right text-purple-400">{formatPos(p.position)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// KPI Card Component
function KpiCard({ title, value, icon: Icon, color, loading }: { title: string, value: string | number, icon: any, color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'zinc', loading?: boolean }) {
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
      </div>
      {/* Background glow effect */}
      <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500", colorStyles[color].split(' ')[1])} />
    </div>
  );
}
