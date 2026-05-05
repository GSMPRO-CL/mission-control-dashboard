'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  CalendarDays, 
  Download,
  CreditCard,
  Percent,
  Activity
} from 'lucide-react';
import { 
  Area, 
  AreaChart, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface PaymentStatusData {
  name: string;
  value: number;
  amount: number;
}

interface TrendData {
  date: string;
  netSales: number;
  grossSales: number;
  orders: number;
}

interface KpiMetrics {
  grossSales: number;
  netSales: number;
  grossOrderCount: number;
  netOrderCount: number;
  totalDiscounts: number;
  netDiscounts: number;
  aov: number;
  averageDailySales: number;
}

interface ApiResponseData {
  kpis: KpiMetrics;
  trend: TrendData[];
  paymentStatuses: PaymentStatusData[];
}

const COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#71717a'];

export default function VentasKpisPage() {
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
      const res = await fetch(`/api/ventas/kpis?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`);
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

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  
  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

  const handleExportCSV = () => {
    if (!data) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Metric,Value\n"
      + `Ventas Totales,${data.kpis.grossSales}\n`
      + `Ventas Totales (Pagadas),${data.kpis.netSales}\n`
      + `Promedio Venta Diaria,${data.kpis.averageDailySales}\n`
      + `Órdenes Totales,${data.kpis.grossOrderCount}\n`
      + `Órdenes Pagadas,${data.kpis.netOrderCount}\n`
      + `Ticket Promedio (AOV),${data.kpis.aov}\n`
      + `Total Descuentos,${data.kpis.totalDiscounts}\n`;
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ventas_kpis_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) return null; // Evita el error de hidratación con fechas

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Ventas: Indicadores (KPIs)</h1>
          <p className="text-zinc-400 mt-1">Rendimiento financiero y volumen de pedidos.</p>
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
          title="Ventas Totales (Pagadas)" 
          value={data ? formatCurrency(data.kpis.netSales) : '...'} 
          icon={DollarSign} 
          color="blue"
          loading={loading}
          subtitle="Solo órdenes 'paid'"
        />
        <KpiCard 
          title="Ventas Totales" 
          value={data ? formatCurrency(data.kpis.grossSales) : '...'} 
          icon={Activity} 
          color="zinc"
          loading={loading}
          subtitle="Sin filtro de estado"
        />
        <KpiCard 
          title="Promedio Venta Diaria" 
          value={data ? formatCurrency(data.kpis.averageDailySales) : '...'} 
          icon={TrendingUp} 
          color="emerald"
          loading={loading}
          subtitle="Ventas pagadas / días"
        />
        <KpiCard 
          title="Ticket Promedio (AOV)" 
          value={data ? formatCurrency(data.kpis.aov) : '...'} 
          icon={CreditCard} 
          color="indigo"
          loading={loading}
          subtitle="Promedio por orden cobrada"
        />
        <KpiCard 
          title="Órdenes Cobradas" 
          value={data ? formatNumber(data.kpis.netOrderCount) : '...'} 
          icon={ShoppingCart} 
          color="blue"
          loading={loading}
          subtitle="Estado 'paid'"
        />
        <KpiCard 
          title="Órdenes Totales" 
          value={data ? formatNumber(data.kpis.grossOrderCount) : '...'} 
          icon={ShoppingCart} 
          color="zinc"
          loading={loading}
          subtitle="Incluye pendientes"
        />
        <KpiCard 
          title="Total Descuentos" 
          value={data ? formatCurrency(data.kpis.totalDiscounts) : '...'} 
          icon={Percent} 
          color="rose"
          loading={loading}
          subtitle="En todo el periodo"
        />
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-6 relative z-10">
            <div>
              <h2 className="text-lg font-bold text-white">Evolución de Ventas Pagadas</h2>
              <p className="text-sm text-zinc-400">Ventas cobradas diariamente</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.trend && data.trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNetSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    stroke="#52525b" 
                    fontSize={12}
                    tickFormatter={(val) => {
                      // Adjust for UTC/timezone issues by parsing simply
                      const parts = val.split('-');
                      if(parts.length === 3) return `${parts[2]}/${parts[1]}`;
                      return val;
                    }}
                  />
                  <YAxis 
                    stroke="#52525b" 
                    fontSize={12}
                    tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                  />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#3b82f6' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ventas Pagadas']}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="netSales" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorNetSales)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                No hay datos para este rango.
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        {/* Placeholder for future Donut Charts */}
        <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-6 relative z-10">Estados de Pago</h2>
          
          <div className="h-[300px] w-full relative z-10 flex items-center justify-center">
            {loading ? (
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            ) : data && data.paymentStatuses && data.paymentStatuses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.paymentStatuses}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.paymentStatuses.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#e4e4e7' }}
                    formatter={(value: any, name: any, props: any) => [
                      `${value} órdenes (${formatCurrency(props.payload.amount)})`, 
                      String(name).toUpperCase()
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-500 text-sm">No hay datos</div>
            )}
            
            {/* Custom Legend */}
            {!loading && data && data.paymentStatuses && (
              <div className="absolute bottom-0 w-full flex flex-wrap justify-center gap-3">
                {data.paymentStatuses.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="capitalize">{entry.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>
      </div>

    </div>
  );
}

function KpiCard({ title, value, icon: Icon, color, loading, subtitle }: any) {
  const colorMap: any = {
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    indigo: 'from-indigo-500/20 to-indigo-600/5 border-indigo-500/20 text-indigo-400',
    rose: 'from-rose-500/20 to-rose-600/5 border-rose-500/20 text-rose-400',
    zinc: 'from-zinc-500/20 to-zinc-600/5 border-white/10 text-zinc-400',
  };

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-6 backdrop-blur-xl transition-all duration-300 hover:shadow-xl group",
      "bg-gradient-to-br bg-zinc-950/50",
      colorMap[color].split(' ')[0], 
      colorMap[color].split(' ')[1],
      colorMap[color].split(' ')[2]
    )}>
      <div className="flex items-center justify-between relative z-10">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className={cn("p-2 rounded-xl bg-white/5", colorMap[color].split(' ')[3])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-4 relative z-10">
        {loading ? (
          <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
        ) : (
          <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
        )}
        <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>
      </div>
      <div className={cn(
        "absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 transition-transform duration-500 group-hover:scale-150",
        color === 'blue' && 'bg-blue-500',
        color === 'emerald' && 'bg-emerald-500',
        color === 'indigo' && 'bg-indigo-500',
        color === 'rose' && 'bg-rose-500',
        color === 'zinc' && 'bg-zinc-500'
      )} />
    </div>
  );
}
