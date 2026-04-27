"use client";

import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownRight, DollarSign, ShoppingBag, Users, Activity, Calendar, Mail } from "lucide-react";

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Resumen Global</h2>
          <p className="text-zinc-400">Métricas principales de E-commerce</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl">
          <Calendar className="w-4 h-4 text-zinc-400 ml-2" />
          <select 
            onChange={handleMonthChange}
            defaultValue="04"
            className="bg-transparent text-sm text-white px-2 py-1 outline-none cursor-pointer appearance-none"
          >
            <option value="all" className="bg-zinc-900">Todo el año (2026)</option>
            <option value="04" className="bg-zinc-900">Abril 2026</option>
            <option value="03" className="bg-zinc-900">Marzo 2026</option>
            <option value="02" className="bg-zinc-900">Febrero 2026</option>
            <option value="01" className="bg-zinc-900">Enero 2026</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Ventas */}
        <div className="glass-card flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <DollarSign className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Ventas Netas (Pagadas)</h3>
            <p className="text-3xl font-bold text-white mt-1">
              {loading ? "..." : shopifyData ? formatCurrency(shopifyData.netSales, shopifyData.currency) : "$0"}
            </p>
          </div>
        </div>

        {/* Órdenes */}
        <div className="glass-card flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <ShoppingBag className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Órdenes Totales</h3>
            <p className="text-3xl font-bold text-white mt-1">
              {loading ? "..." : shopifyData?.totalOrders || "0"}
            </p>
          </div>
        </div>

        {/* Marketing (Klaviyo) */}
        <div className="glass-card flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Mail className="w-5 h-5 text-orange-400" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Emails Abiertos</h3>
            <p className="text-3xl font-bold text-white mt-1">
              {loading ? "..." : klaviyoData?.openedCount || "0"}
            </p>
          </div>
        </div>

        {/* Crisp / Support */}
        <div className="glass-card flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h3 className="text-zinc-400 font-medium text-sm">Satisfacción (CSAT)</h3>
            <p className="text-3xl font-bold text-white mt-1">
              {loading ? "..." : crispData?.avgCsat > 0 ? `${crispData.avgCsat}/5` : "N/A"}
            </p>
          </div>
        </div>

      </div>

      {/* Overview Chart (Recharts) */}
      <div className="glass-card p-6 mt-6">
         <h3 className="text-lg font-bold text-white mb-4">Módulo General Activo</h3>
         <div className="h-64 flex items-center justify-center border border-dashed border-white/10 rounded-xl">
           <p className="text-zinc-500">Los datos reales están siendo inyectados exitosamente desde BigQuery.</p>
         </div>
      </div>
    </div>
  );
}
