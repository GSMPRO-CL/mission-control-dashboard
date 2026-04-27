"use client";

import { useState, useEffect } from 'react';
import { MessageSquare, MessageCircle, Star, Calendar } from "lucide-react";

export default function SupportPage() {
  const [startDate, setStartDate] = useState('2026-04-01T00:00:00Z');
  const [endDate, setEndDate] = useState('2026-04-30T23:59:59Z');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/kpis/crisp?startDate=${startDate}&endDate=${endDate}`);
        setData(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Soporte (Crisp)</h2>
          <p className="text-zinc-400">Análisis de atención al cliente y satisfacción.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card flex flex-col gap-4">
          <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 w-fit"><MessageSquare className="w-5 h-5 text-blue-400" /></div>
          <div><h3 className="text-zinc-400 font-medium text-sm">Total Conversaciones</h3><p className="text-3xl font-bold text-white mt-1">{loading ? "..." : data?.totalConversations || 0}</p></div>
        </div>
        <div className="glass-card flex flex-col gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 w-fit"><MessageCircle className="w-5 h-5 text-emerald-400" /></div>
          <div><h3 className="text-zinc-400 font-medium text-sm">Conversaciones Resueltas</h3><p className="text-3xl font-bold text-white mt-1">{loading ? "..." : data?.resolvedConversations || 0}</p></div>
        </div>
        <div className="glass-card flex flex-col gap-4">
          <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20 w-fit"><Star className="w-5 h-5 text-yellow-400" /></div>
          <div><h3 className="text-zinc-400 font-medium text-sm">CSAT Promedio</h3><p className="text-3xl font-bold text-white mt-1">{loading ? "..." : data?.avgCsat > 0 ? `${data.avgCsat}/5` : "N/A"}</p></div>
        </div>
      </div>
    </div>
  );
}
