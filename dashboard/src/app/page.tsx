'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  MousePointerClick, 
  Users, 
  Star, 
  HeadphonesIcon,
  CalendarDays,
  Mail,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'framer-motion';

import { KpiCard } from '@/components/ui/KpiCard';
import { MiniAreaChart } from '@/components/ui/MiniAreaChart';
import { MiniList } from '@/components/ui/MiniList';

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

export default function GeneralDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Selector de fechas Global (MTD por defecto)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      try {
        const res = await fetch(`/api/overview?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Error fetching overview data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
  }, [startDate, endDate]);

  const formatCurrency = (val: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(val);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-zinc-400 mt-1 text-sm">Resumen global de operaciones y rendimiento del negocio.</p>
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
        </div>
      </div>

      {/* Discreet Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-center text-sm shadow-inner">
        <Activity className="w-4 h-4 text-blue-400 mr-2" />
        <span className="text-blue-200 font-medium">El ecosistema de datos está unificado.</span>
        <span className="text-zinc-400 ml-2 hidden md:inline">Explora los módulos laterales para obtener detalles operativos.</span>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-6"
      >
        {/* ROW 1: Main KPIs (4 columns) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Ventas Netas" 
              value={data ? formatCurrency(data.ventas.netSales, data.ventas.currency) : '$0'}
              icon={DollarSign}
              color="blue"
              loading={loading}
              subtitle="Shopify"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Órdenes Totales" 
              value={data ? formatNumber(data.ventas.totalOrders) : '0'}
              icon={ShoppingCart}
              color="purple"
              loading={loading}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Sesiones" 
              value={data ? formatNumber(data.trafico.totalSessions) : '0'}
              icon={Users}
              color="cyan"
              loading={loading}
              subtitle="Tráfico"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <KpiCard 
              title="Conversion Rate" 
              value={data ? `${data.trafico.avgConversionRate.toFixed(2)}%` : '0%'}
              icon={MousePointerClick}
              color="emerald"
              loading={loading}
              subtitle="CVR"
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
              data={data?.ventas?.trend || []}
              dataKeys={[{ key: 'netSales', name: 'Ventas Netas', color: '#3b82f6' }]}
              xAxisKey="date"
              yAxisFormatter={(val) => `$${(val/1000).toFixed(1)}k`}
            />
          </motion.div>
          <motion.div variants={itemVariants} className="h-full">
            <MiniAreaChart 
              title="Tendencia de Tráfico"
              subtitle="Sesiones vs Visitantes Únicos"
              loading={loading}
              data={data?.trafico?.trend || []}
              dataKeys={[
                { key: 'sessions', name: 'Sesiones', color: '#06b6d4' },
                { key: 'visitors', name: 'Visitantes', color: '#8b5cf6' }
              ]}
              xAxisKey="date"
              yAxisFormatter={(val) => `${(val/1000).toFixed(1)}k`}
            />
          </motion.div>
        </div>

        {/* ROW 3: Secondary Modules (3 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sub-grid 2x2 for secondary KPIs */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div variants={itemVariants}>
              <KpiCard 
                title="Revenue Email Marketing" 
                value={data ? formatCurrency(data.marketing.emailRevenue) : '$0'}
                icon={Mail}
                color="rose"
                loading={loading}
                subtitle={`Klaviyo - ${data?.marketing?.emailOrders || 0} órdenes`}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <KpiCard 
                title="Tasa de Resolución" 
                value={data ? `${data.soporte.resolutionRate.toFixed(1)}%` : '0%'}
                icon={CheckCircle2}
                color="emerald"
                loading={loading}
                subtitle={`${data?.soporte?.resolvedConversations || 0} de ${data?.soporte?.totalConversations || 0} resueltos`}
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <KpiCard 
                title="CSAT (Soporte)" 
                value={data ? `${data.soporte.avgCsat}/5` : '0/5'}
                icon={HeadphonesIcon}
                color="amber"
                loading={loading}
                subtitle="Crisp"
              />
            </motion.div>
            <motion.div variants={itemVariants}>
              <KpiCard 
                title="Rating (Reviews)" 
                value={data ? `${data.reviews.averageRating} ⭐` : '0 ⭐'}
                icon={Star}
                color="orange"
                loading={loading}
                subtitle="Yotpo"
              />
            </motion.div>
          </div>
          
          {/* List for Activity */}
          <motion.div variants={itemVariants} className="h-full">
            <MiniList 
              title="Actividad del Equipo"
              icon={Activity}
              loading={loading}
              items={data?.equipo?.topStaff?.map((s: any) => ({
                label: s.name,
                sublabel: 'Eventos registrados',
                value: s.events
              })) || []}
            />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
