"use client";

import { useState, useEffect } from 'react';
import { Mail, MailOpen, MousePointerClick, Calendar, Search, MousePointer2, Eye } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MarketingPage() {
  const [startDate, setStartDate] = useState('2026-04-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2026-04-30T23:59:59Z');
  
  // Klaviyo State
  const [klaviyoData, setKlaviyoData] = useState<any>(null);
  const [loadingKlaviyo, setLoadingKlaviyo] = useState(true);

  // GSC State
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
          // Formatear datos para el gráfico
          const formattedGscData = gscJson.data.map((row: any) => ({
            date: new Date(row.date.value).toLocaleDateString('es-CL', { month: 'short', day: 'numeric' }),
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr * 100, // a porcentaje
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
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Marketing & SEO</h2>
          <p className="text-zinc-400">Rendimiento de Email Marketing y Búsqueda Orgánica.</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-xl">
          <Calendar className="w-4 h-4 text-zinc-400 ml-2" />
          <select onChange={handleMonthChange} defaultValue="04" className="bg-transparent text-sm text-white px-2 py-1 outline-none cursor-pointer appearance-none">
            <option value="all" className="bg-zinc-900">Todo el año</option>
            <option value="04" className="bg-zinc-900">Abril 2026</option>
            <option value="03" className="bg-zinc-900">Marzo 2026</option>
            <option value="02" className="bg-zinc-900">Febrero 2026</option>
            <option value="01" className="bg-zinc-900">Enero 2026</option>
          </select>
        </div>
      </div>

      {/* Klaviyo Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white/90">Email Marketing (Klaviyo)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20 w-fit"><Mail className="w-5 h-5 text-orange-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">Ingresos Klaviyo (Aprox)</h3><p className="text-3xl font-bold text-white mt-1">{loadingKlaviyo ? "..." : formatCurrency(klaviyoData?.attributedRevenue || 0)}</p></div>
          </div>
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 w-fit"><MailOpen className="w-5 h-5 text-blue-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">Emails Abiertos</h3><p className="text-3xl font-bold text-white mt-1">{loadingKlaviyo ? "..." : klaviyoData?.openedCount || 0}</p></div>
          </div>
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 w-fit"><MousePointerClick className="w-5 h-5 text-emerald-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">Clicks en Emails</h3><p className="text-3xl font-bold text-white mt-1">{loadingKlaviyo ? "..." : klaviyoData?.clickedCount || 0}</p></div>
          </div>
        </div>
      </div>

      {/* Google Search Console Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
          <Search className="w-5 h-5 text-indigo-400" />
          Rendimiento Orgánico (Google Search Console)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 w-fit"><MousePointer2 className="w-5 h-5 text-indigo-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">Total Clicks Orgánicos</h3><p className="text-3xl font-bold text-white mt-1">{loadingGsc ? "..." : totalGscClicks.toLocaleString('es-CL')}</p></div>
          </div>
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 w-fit"><Eye className="w-5 h-5 text-purple-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">Total Impresiones</h3><p className="text-3xl font-bold text-white mt-1">{loadingGsc ? "..." : totalGscImpressions.toLocaleString('es-CL')}</p></div>
          </div>
          <div className="glass-card flex flex-col gap-4">
            <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20 w-fit"><Search className="w-5 h-5 text-pink-400" /></div>
            <div><h3 className="text-zinc-400 font-medium text-sm">CTR Promedio</h3><p className="text-3xl font-bold text-white mt-1">{loadingGsc ? "..." : `${avgGscCtr}%`}</p></div>
          </div>
        </div>

        <div className="glass-card mt-6 p-6">
          <h3 className="text-lg font-semibold text-white/90 mb-6">Clicks e Impresiones</h3>
          <div className="h-[300px] w-full">
            {loadingGsc ? (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">Cargando datos...</div>
            ) : gscData.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos para este periodo</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gscData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#818cf8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#c084fc" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="clicks" name="Clicks" stroke="#818cf8" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impresiones" stroke="#c084fc" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
