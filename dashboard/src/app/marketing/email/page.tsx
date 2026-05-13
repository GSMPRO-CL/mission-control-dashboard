"use client";

import { useState, useEffect } from 'react';
import { Mail, MailOpen, MousePointerClick, AlertTriangle, Users, BarChart3, Calendar, ShoppingCart, TrendingUp, Target } from "lucide-react";
import { motion, Variants } from 'framer-motion';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function MarketingEmailPage() {
  const now = new Date();
  const monthOptions = [
    {
      label: `Todo el año (${now.getFullYear()})`,
      value: 'all',
      start: new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0)).toISOString(),
      end: new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59)).toISOString()
    }
  ];

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(d).replace(/^./, str => str.toUpperCase());
    const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)).toISOString();
    monthOptions.push({ label, value: `month-${i}`, start, end });
  }

  const [selectedPeriod, setSelectedPeriod] = useState(monthOptions[1].value); // Default to current month
  const currentOption = monthOptions.find(o => o.value === selectedPeriod) || monthOptions[1];
  const startDate = currentOption.start;
  const endDate = currentOption.end;
  
  const [klaviyoData, setKlaviyoData] = useState<any>(null);
  const [loadingKlaviyo, setLoadingKlaviyo] = useState(true);
  const [activeTab, setActiveTab] = useState<'flows' | 'campaigns'>('flows');

  useEffect(() => {
    async function fetchData() {
      setLoadingKlaviyo(true);
      try {
        const res = await fetch(`/api/kpis/klaviyo?startDate=${startDate}&endDate=${endDate}`);
        const data = await res.json();
        setKlaviyoData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingKlaviyo(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPeriod(e.target.value);
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const formatPercent = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);

  const renderDelta = (delta: number) => {
    if (delta === undefined || delta === null) return null;
    const isPositive = delta >= 0;
    return (
      <div className={cn("flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-white/5", isPositive ? "text-emerald-400" : "text-rose-400")}>
        {isPositive ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% vs anterior
      </div>
    );
  };

  const Sparkline = ({ data, dataKey, color }: { data: any[], dataKey: string, color: string }) => (
    <div className="absolute inset-x-0 bottom-0 h-24 opacity-30 pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.8} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#gradient-${dataKey})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  const renderAttributionTable = (data: any[], type: 'flows' | 'campaigns') => {
    if (!data || data.length === 0) return <div className="p-8 text-center text-zinc-500">No hay datos disponibles para el periodo seleccionado.</div>;
    
    const maxRevenue = Math.max(...data.map(d => d.revenue));

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-white/5 text-xs uppercase font-semibold text-zinc-400">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">{type === 'flows' ? 'Automatización (Flow)' : 'Campaña'}</th>
              <th className="px-4 py-3">Ingresos Atribuidos</th>
              <th className="px-4 py-3">Órdenes</th>
              <th className="px-4 py-3">Click Rate</th>
              <th className="px-4 py-3">CTOR</th>
              <th className="px-4 py-3 rounded-tr-lg">AOV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors group">
                <td className="px-4 py-4 font-medium text-white max-w-xs truncate" title={item.name}>{item.name || '(Sin Nombre)'}</td>
                <td className="px-4 py-4 min-w-[150px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-white">{formatCurrency(item.revenue)}</span>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(item.revenue / maxRevenue) * 100}%` }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">{new Intl.NumberFormat('es-CL').format(item.orders)}</td>
                <td className="px-4 py-4">{formatPercent(item.cr)}</td>
                <td className="px-4 py-4">{formatPercent(item.ctor)}</td>
                <td className="px-4 py-4">{formatCurrency(item.aov)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
      
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide uppercase">
            <Mail className="w-3.5 h-3.5" /> Growth & Retención
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Email Marketing Analytics</h2>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Métricas de eficiencia y rendimiento financiero de campañas y flujos de correo electrónico.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl shadow-xl">
          <div className="p-2 bg-white/5 rounded-xl">
            <Calendar className="w-4 h-4 text-zinc-400" />
          </div>
          <select value={selectedPeriod} onChange={handleMonthChange} className="bg-transparent text-sm font-semibold text-white pr-4 py-1 outline-none cursor-pointer appearance-none">
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-zinc-900">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Klaviyo Efficiency Metrics Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Revenue */}
        <div className="glass-card flex flex-col gap-4 group p-6 col-span-1 md:col-span-2 relative overflow-hidden">
          {klaviyoData?.dailyTrends && <Sparkline data={klaviyoData.dailyTrends} dataKey="revenue" color="#f43f5e" />}
          <div className="flex justify-between items-start z-10">
            <div className="p-2.5 bg-gradient-to-br from-rose-500/20 to-rose-600/10 rounded-xl border border-rose-500/20 w-fit">
              <BarChart3 className="w-5 h-5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
            </div>
            {klaviyoData?.deltas && renderDelta(klaviyoData.deltas.revenue)}
          </div>
          <div className="z-10 mt-auto pt-8">
            <h3 className="text-zinc-400 font-medium text-sm mb-1">Ingresos Atribuidos (Klaviyo)</h3>
            <div className="h-12">
              {loadingKlaviyo ? <Skeleton className="h-10 w-40" /> : <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-rose-100 to-rose-400">{formatCurrency(klaviyoData?.current?.revenue || 0)}</p>}
            </div>
          </div>
        </div>

        {/* AOV */}
        <div className="glass-card flex flex-col gap-4 p-6 col-span-1 md:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="flex justify-between items-start z-10">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 w-fit">
              <ShoppingCart className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
            {klaviyoData?.deltas && renderDelta(klaviyoData.deltas.aov)}
          </div>
          <div className="z-10 mt-auto pt-8">
            <h3 className="text-zinc-400 font-medium text-sm mb-1">AOV de Email (Ticket Promedio)</h3>
            <div className="h-12">
              {loadingKlaviyo ? <Skeleton className="h-10 w-32" /> : <p className="text-4xl font-bold text-white">{formatCurrency(klaviyoData?.current?.aov || 0)}</p>}
            </div>
          </div>
        </div>

        {/* CTOR */}
        <div className="glass-card flex flex-col gap-4 p-6 relative overflow-hidden">
          {klaviyoData?.dailyTrends && <Sparkline data={klaviyoData.dailyTrends} dataKey="opens" color="#3b82f6" />}
          <div className="flex justify-between items-start z-10">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl border border-blue-500/20 w-fit">
              <MailOpen className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            </div>
            {klaviyoData?.deltas && renderDelta(klaviyoData.deltas.ctor)}
          </div>
          <div className="z-10 pt-4">
            <h3 className="text-zinc-400 font-medium text-sm mb-1">CTOR %</h3>
            <div className="h-10">
              {loadingKlaviyo ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-bold text-white">{formatPercent(klaviyoData?.current?.ctor || 0)}</p>}
            </div>
            <p className="text-xs text-zinc-500 mt-2">Clics sobre Aperturas</p>
          </div>
        </div>

        {/* CR */}
        <div className="glass-card flex flex-col gap-4 p-6 relative overflow-hidden">
          {klaviyoData?.dailyTrends && <Sparkline data={klaviyoData.dailyTrends} dataKey="clicks" color="#8b5cf6" />}
          <div className="flex justify-between items-start z-10">
            <div className="p-2.5 bg-gradient-to-br from-violet-500/20 to-violet-600/10 rounded-xl border border-violet-500/20 w-fit">
              <MousePointerClick className="w-5 h-5 text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
            </div>
            {klaviyoData?.deltas && renderDelta(klaviyoData.deltas.cr)}
          </div>
          <div className="z-10 pt-4">
            <h3 className="text-zinc-400 font-medium text-sm mb-1">Click Rate (CR)</h3>
            <div className="h-10">
              {loadingKlaviyo ? <Skeleton className="h-9 w-20" /> : <p className="text-3xl font-bold text-white">{formatPercent(klaviyoData?.current?.cr || 0)}</p>}
            </div>
            <p className="text-xs text-zinc-500 mt-2">Clics sobre Entregados</p>
          </div>
        </div>

        {/* Placed Order Rate */}
        <div className="glass-card flex flex-col gap-4 p-6 md:col-span-2 relative overflow-hidden border-orange-500/20">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-orange-500/5 to-transparent pointer-events-none" />
          <div className="flex justify-between items-start z-10">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl border border-orange-500/20 w-fit">
              <Target className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
            </div>
            {klaviyoData?.deltas && renderDelta(klaviyoData.deltas.orderRate)}
          </div>
          <div className="z-10 pt-4">
            <h3 className="text-zinc-400 font-medium text-sm mb-1">Placed Order Rate</h3>
            <div className="h-10">
              {loadingKlaviyo ? <Skeleton className="h-9 w-24" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-100 to-orange-400">{formatPercent(klaviyoData?.current?.orderRate || 0)}</p>}
            </div>
            <p className="text-xs text-zinc-500 mt-2">Órdenes generadas por clics efectivos</p>
          </div>
        </div>

      </motion.div>

      {/* Attribution Section */}
      <motion.div variants={itemVariants} className="glass-card flex flex-col p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-rose-400" />
              Análisis de Atribución
            </h3>
            <p className="text-sm text-zinc-400 mt-1">Comparativa de rendimiento entre Automatizaciones y Campañas.</p>
          </div>
          
          <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-white/10 w-fit">
            <button 
              onClick={() => setActiveTab('flows')}
              className={cn("px-4 py-1.5 text-sm font-semibold rounded-lg transition-all", activeTab === 'flows' ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white")}
            >
              Flows
            </button>
            <button 
              onClick={() => setActiveTab('campaigns')}
              className={cn("px-4 py-1.5 text-sm font-semibold rounded-lg transition-all", activeTab === 'campaigns' ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-white")}
            >
              Campañas
            </button>
          </div>
        </div>

        {loadingKlaviyo ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          renderAttributionTable(activeTab === 'flows' ? klaviyoData?.flows : klaviyoData?.campaigns, activeTab)
        )}
      </motion.div>
    </motion.div>
  );
}
