'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  Activity, 
  CalendarDays, 
  Download,
  CreditCard,
  PieChart as PieChartIcon,
  Tag
} from 'lucide-react';
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';

import { KpiCard } from '@/components/ui/KpiCard';
import { MiniAreaChart } from '@/components/ui/MiniAreaChart';
import { MiniList } from '@/components/ui/MiniList';
import { TopProductsTable } from '@/components/ventas/TopProductsTable';
import { NavigationCard } from '@/components/ventas/NavigationCard';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
};

const COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#71717a'];

export default function VentasResumenPage() {
  const [data, setData] = useState<any>(null);
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
      const res = await fetch(`/api/ventas/resumen?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`);
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
      + `Ventas Netas,${data.kpis.netSales}\n`
      + `Ventas Brutas,${data.kpis.grossSales}\n`
      + `Promedio Venta Diaria,${data.kpis.avgDailySales}\n`
      + `Órdenes Cobradas,${data.kpis.netOrderCount}\n`
      + `Órdenes Totales,${data.kpis.grossOrderCount}\n`
      + `Ticket Promedio (AOV),${data.kpis.aov}\n`
      + `Total Descuentos,${data.kpis.totalDiscounts}\n`;
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ventas_resumen_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Ventas Overview</h1>
          <p className="text-zinc-400 mt-1">Resumen ejecutivo del rendimiento comercial y productos.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
            <CalendarDays className="w-4 h-4 text-zinc-400 ml-2" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [color-scheme:dark]"
            />
            <span className="text-zinc-500">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [color-scheme:dark]"
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

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* ROW 1: Main KPIs (4 columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Ventas Netas (Pagadas)" 
              value={data ? formatCurrency(data.kpis.netSales) : '$0'}
              icon={DollarSign}
              color="blue"
              loading={loading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Órdenes Cobradas" 
              value={data ? formatNumber(data.kpis.netOrderCount) : '0'}
              icon={ShoppingCart}
              color="purple"
              loading={loading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Ticket Promedio (AOV)" 
              value={data ? formatCurrency(data.kpis.aov) : '$0'}
              icon={CreditCard}
              color="emerald"
              loading={loading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Promedio Venta Diaria" 
              value={data ? formatCurrency(data.kpis.avgDailySales) : '$0'}
              icon={Activity}
              color="cyan"
              loading={loading}
            />
          </motion.div>
        </div>

        {/* ROW 2: Trend Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[320px]">
          <motion.div variants={itemVariants} className="h-full">
            <MiniAreaChart 
              title="Evolución de Ventas"
              subtitle="Ventas netas pagadas por día"
              loading={loading}
              data={data?.trend || []}
              dataKeys={[{ key: 'netSales', name: 'Ventas Netas', color: '#3b82f6' }]}
              xAxisKey="date"
              yAxisFormatter={(val) => `$${(val/1000).toFixed(1)}k`}
            />
          </motion.div>
          <motion.div variants={itemVariants} className="h-full">
            <MiniAreaChart 
              title="Órdenes Diarias"
              subtitle="Volumen de órdenes cobradas"
              loading={loading}
              data={data?.trend || []}
              dataKeys={[{ key: 'orders', name: 'Órdenes', color: '#a855f7' }]}
              xAxisKey="date"
              yAxisFormatter={(val) => val.toString()}
            />
          </motion.div>
        </div>

        {/* ROW 3: Top Products & Brands */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
          <motion.div variants={itemVariants} className="lg:col-span-2 h-full">
            <TopProductsTable 
              products={data?.topProducts || []} 
              loading={loading} 
            />
          </motion.div>
          <motion.div variants={itemVariants} className="lg:col-span-1 h-full">
            <MiniList 
              title="Top Marcas"
              icon={Tag}
              loading={loading}
              items={data?.topBrands?.map((b: any) => ({
                label: b.brand,
                sublabel: `${formatNumber(b.quantity)} unidades vendidas`,
                value: formatCurrency(b.revenue)
              })) || []}
            />
          </motion.div>
        </div>

        {/* ROW 4: Donut & Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[240px]">
          {/* Donut Chart: Payment Statuses */}
          <motion.div variants={itemVariants} className="h-[300px] md:h-full">
            <div className="glass-card p-6 h-full flex flex-col relative overflow-hidden group">
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <PieChartIcon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">Estados de Pago</h3>
              </div>
              
              <div className="flex-1 w-full relative z-10 flex items-center justify-center">
                {loading ? (
                  <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                ) : data && data.paymentStatuses && data.paymentStatuses.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.paymentStatuses}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {data.paymentStatuses.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                        itemStyle={{ color: '#e4e4e7' }}
                        formatter={(value: any, name: any) => [
                          `${value} órdenes`, 
                          String(name).toUpperCase()
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-zinc-500 text-sm">No hay datos</div>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Navigation Cards */}
          <motion.div variants={itemVariants} className="h-full">
            <NavigationCard 
              title="Indicadores Financieros"
              description="Análisis profundo de finanzas, ventas, carritos y ticket promedio."
              href="/ventas/kpis"
              icon={DollarSign}
              color="blue"
            />
          </motion.div>
          <motion.div variants={itemVariants} className="h-full">
            <NavigationCard 
              title="Rendimiento de Productos"
              description="Ranking completo de SKUs, marcas y rendimiento SEO."
              href="/ventas/productos"
              icon={ShoppingCart}
              color="indigo"
            />
          </motion.div>
        </div>

      </motion.div>
    </div>
  );
}
