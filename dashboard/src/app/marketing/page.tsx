"use client";

import { useState, useEffect } from 'react';
import { Mail, MailOpen, MousePointerClick, Calendar, Search, MousePointer2, Eye } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl shadow-black">
        <p className="text-zinc-400 text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-white font-medium">{entry.name}:</span>
            <span className="text-white font-bold">{entry.value.toLocaleString('es-CL')}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function MarketingPage() {
  const [startDate, setStartDate] = useState('2026-04-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2026-04-30T23:59:59Z');
  
  const [klaviyoData, setKlaviyoData] = useState<any>(null);
  const [loadingKlaviyo, setLoadingKlaviyo] = useState(true);

  const [gscData, setGscData] = useState<any[]>([]);
  const [loadingGsc, setLoadingGsc] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoadingKlaviyo(true);
      setLoadingGsc(true);
      try {
        const [klaviyoRes, gscRes] = await Promise.all([
          fetch(`/api/kpis/klaviyo?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/gsc?startDate=${startDate.split('T')[0]}&endDate=${endDate.split('T')[0]}`)
        ]);
        
        setKlaviyoData(await klaviyoRes.json());
        
        const gscJson = await gscRes.json();
        if (gscJson.success) {
          const formattedGscData = gscJson.data.map((row: any) => ({
            date: new Date(row.date.value).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }),
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr * 100,
            position: row.position
          }));
          setGscData(formattedGscData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingKlaviyo(false);
        setLoadingGsc(false);
      }
    }
    fetchData();
  }, [startDate, endDate]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const month = e.target.value;
    if (month === '04') { setStartDate('2026-04-01T00:00:00Z'); setEndDate('2026-04-30T23:59:59Z'); }
    else if (month === '03') { setStartDate('2026-03-01T00:00:00Z'); setEndDate('2026-03-31T23:59:59Z'); }
    else if (month === '02') { setStartDate('2026-02-01T00:00:00Z'); setEndDate('2026-02-28T23:59:59Z'); }
    else if (month === '01') { setStartDate('2026-01-01T00:00:00Z'); setEndDate('2026-01-31T23:59:59Z'); }
    else if (month === 'all') { setStartDate('2026-01-01T00:00:00Z'); setEndDate('2026-12-31T23:59:59Z'); }
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const totalGscClicks = gscData.reduce((sum, row) => sum + row.clicks, 0);
  const totalGscImpressions = gscData.reduce((sum, row) => sum + row.impressions, 0);
  const avgGscCtr = gscData.length > 0 ? (gscData.reduce((sum, row) => sum + row.ctr, 0) / gscData.length).toFixed(2) : 0;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Marketing & SEO</h2>
          <p className="text-zinc-400 mt-1">Rendimiento de Email Marketing y Búsqueda Orgánica.</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 p-2 rounded-2xl cursor-pointer">
          <Calendar className="w-4 h-4 text-zinc-400 ml-2" />
          <select onChange={handleMonthChange} defaultValue="04" className="bg-transparent text-sm font-medium text-white px-2 py-1 outline-none cursor-pointer appearance-none">
            <option value="all" className="bg-zinc-900">Todo el año</option>
            <option value="04" className="bg-zinc-900">Abril 2026</option>
            <option value="03" className="bg-zinc-900">Marzo 2026</option>
            <option value="02" className="bg-zinc-900">Febrero 2026</option>
            <option value="01" className="bg-zinc-900">Enero 2026</option>
          </select>
        </div>
      </motion.div>

      {/* Klaviyo Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-semibold text-white/90 tracking-tight">Email Marketing (Klaviyo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-xl border border-orange-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <Mail className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">Ingresos Klaviyo (Aprox)</h3>
              <div className="mt-2 h-10">
                {loadingKlaviyo ? <Skeleton className="h-9 w-32" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{formatCurrency(klaviyoData?.attributedRevenue || 0)}</p>}
              </div>
            </div>
          </div>
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-xl border border-blue-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <MailOpen className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">Emails Abiertos</h3>
              <div className="mt-2 h-10">
                {loadingKlaviyo ? <Skeleton className="h-9 w-24" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{klaviyoData?.openedCount || 0}</p>}
              </div>
            </div>
          </div>
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-xl border border-emerald-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <MousePointerClick className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">Clicks en Emails</h3>
              <div className="mt-2 h-10">
                {loadingKlaviyo ? <Skeleton className="h-9 w-20" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{klaviyoData?.clickedCount || 0}</p>}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* GSC Section */}
      <motion.div variants={itemVariants} className="space-y-4">
        <h3 className="text-xl font-semibold text-white/90 flex items-center gap-2 tracking-tight">
          <Search className="w-6 h-6 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
          Rendimiento Orgánico (Google Search Console)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 rounded-xl border border-indigo-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <MousePointer2 className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">Total Clicks Orgánicos</h3>
              <div className="mt-2 h-10">
                {loadingGsc ? <Skeleton className="h-9 w-24" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{totalGscClicks.toLocaleString('es-CL')}</p>}
              </div>
            </div>
          </div>
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-purple-600/10 rounded-xl border border-purple-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <Eye className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">Total Impresiones</h3>
              <div className="mt-2 h-10">
                {loadingGsc ? <Skeleton className="h-9 w-32" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{totalGscImpressions.toLocaleString('es-CL')}</p>}
              </div>
            </div>
          </div>
          <div className="glass-card flex flex-col gap-5 group">
            <div className="p-2.5 bg-gradient-to-br from-pink-500/20 to-pink-600/10 rounded-xl border border-pink-500/20 w-fit group-hover:scale-110 transition-transform duration-300">
              <Search className="w-5 h-5 text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]" />
            </div>
            <div>
              <h3 className="text-zinc-400 font-medium text-sm">CTR Promedio</h3>
              <div className="mt-2 h-10">
                {loadingGsc ? <Skeleton className="h-9 w-16" /> : <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">{avgGscCtr}%</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card mt-6 p-8">
          <h3 className="text-xl font-semibold text-white/90 mb-8 tracking-tight">Evolución de Tráfico Orgánico</h3>
          <div className="h-[350px] w-full">
            {loadingGsc ? (
              <div className="w-full h-full flex items-center justify-center">
                 <Skeleton className="w-full h-full rounded-xl opacity-20" />
              </div>
            ) : gscData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 font-medium">No hay datos para este periodo</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={gscData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c084fc" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#c084fc" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis yAxisId="left" stroke="#818cf8" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <YAxis yAxisId="right" orientation="right" stroke="#c084fc" fontSize={12} tickLine={false} axisLine={false} dx={10} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#818cf8" strokeWidth={3} fillOpacity={1} fill="url(#colorClicks)" activeDot={{ r: 8, strokeWidth: 0, fill: '#818cf8' }} />
                  <Area yAxisId="right" type="monotone" dataKey="impressions" name="Impresiones" stroke="#c084fc" strokeWidth={3} fillOpacity={1} fill="url(#colorImpressions)" activeDot={{ r: 8, strokeWidth: 0, fill: '#c084fc' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}
