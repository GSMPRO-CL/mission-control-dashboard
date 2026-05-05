"use client";

import { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Activity, Calendar, Mail } from "lucide-react";
import { motion, Variants } from 'framer-motion';
import { Skeleton } from '@/components/ui/Skeleton';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Home() {
  const [startDate, setStartDate] = useState('2026-04-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2026-04-30T23:59:59Z');
  
  const [shopifyData, setShopifyData] = useState<any>(null);
  const [klaviyoData, setKlaviyoData] = useState<any>(null);
  const [crispData, setCrispData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [shopRes, klavRes, crispRes] = await Promise.all([
          fetch(`/api/kpis/shopify?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/kpis/klaviyo?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/kpis/crisp?startDate=${startDate}&endDate=${endDate}`)
        ]);
        
        setShopifyData(await shopRes.json());
        setKlaviyoData(await klavRes.json());
        setCrispData(await crispRes.json());
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const month = e.target.value;
    if (month === '04') {
      setStartDate('2026-04-01T00:00:00Z');
      setEndDate('2026-04-30T23:59:59Z');
    } else if (month === '03') {
      setStartDate('2026-03-01T00:00:00Z');
      setEndDate('2026-03-31T23:59:59Z');
    } else if (month === '02') {
      setStartDate('2026-02-01T00:00:00Z');
      setEndDate('2026-02-28T23:59:59Z');
    } else if (month === '01') {
      setStartDate('2026-01-01T00:00:00Z');
      setEndDate('2026-01-31T23:59:59Z');
    } else if (month === 'all') {
      setStartDate('2026-01-01T00:00:00Z');
      setEndDate('2026-12-31T23:59:59Z');
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: currency || 'CLP',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Resumen Global</h2>
          <p className="text-zinc-400 mt-1">Métricas principales de E-commerce</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-2 rounded-2xl cursor-pointer">
          <Calendar className="w-4 h-4 text-zinc-400 ml-2" />
          <select 
            onChange={handleMonthChange}
            defaultValue="04"
            className="bg-transparent text-sm font-medium text-white px-2 py-1 outline-none cursor-pointer appearance-none"
          >
            <option value="all" className="bg-zinc-900">Todo el año (2026)</option>
            <option value="04" className="bg-zinc-900">Abril 2026</option>
            <option value="03" className="bg-zinc-900">Marzo 2026</option>
            <option value="02" className="bg-zinc-900">Febrero 2026</option>
            <option value="01" className="bg-zinc-900">Enero 2026</option>
          </select>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Ventas */}
        <div className="glass-card flex flex-col gap-5 group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Ventas Netas (Pagadas)</h3>
            <div className="mt-2 h-10">
              {loading ? (
                <Skeleton className="h-9 w-32" />
              ) : (
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 tracking-tight">
                  {shopifyData ? formatCurrency(shopifyData.netSales, shopifyData.currency) : "$0"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Órdenes */}
        <div className="glass-card flex flex-col gap-5 group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl border border-purple-500/20 group-hover:scale-110 transition-transform duration-300">
              <ShoppingBag className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Órdenes Totales</h3>
            <div className="mt-2 h-10">
              {loading ? (
                <Skeleton className="h-9 w-24" />
              ) : (
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 tracking-tight">
                  {shopifyData?.totalOrders || "0"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Marketing (Klaviyo) */}
        <div className="glass-card flex flex-col gap-5 group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl border border-orange-500/20 group-hover:scale-110 transition-transform duration-300">
              <Mail className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Emails Abiertos</h3>
            <div className="mt-2 h-10">
              {loading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 tracking-tight">
                  {klaviyoData?.openedCount || "0"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Crisp / Support */}
        <div className="glass-card flex flex-col gap-5 group">
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
              <Activity className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Satisfacción (CSAT)</h3>
            <div className="mt-2 h-10">
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400 tracking-tight">
                  {crispData?.avgCsat > 0 ? `${crispData.avgCsat}/5` : "N/A"}
                </p>
              )}
            </div>
          </div>
        </div>

      </motion.div>

      {/* Overview Chart Container */}
      <motion.div variants={itemVariants} className="glass-card p-8 mt-6">
         <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Módulo General Activo</h3>
         <div className="h-72 flex items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/20">
           <p className="text-zinc-500 font-medium">Los datos reales están siendo inyectados exitosamente desde BigQuery.</p>
         </div>
      </motion.div>
    </motion.div>
  );
}
