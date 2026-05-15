"use client";

import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  MessageCircle, 
  Star, 
  CalendarDays, 
  Download,
  Smile,
  Frown,
  Meh,
  Clock,
  UserCheck,
  Layers,
  Activity,
  GitBranch,
  ExternalLink
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { cn } from '@/lib/utils';

interface KpiData {
  totalConversations: number;
  resolvedConversations: number;
  avgCsat: number;
}

interface SentimentData {
  date: string;
  avg_score: number;
  negative_tickets: number;
  neutral_tickets: number;
  positive_tickets: number;
}

interface AgentData {
  operator_name: string;
  total_tickets: number;
  resolved_tickets: number;
  avg_ttfr: number | null;
  avg_csat: number | null;
}

interface PeakHoursData {
  hourOfDay: number;
  total_tickets: number;
}

interface ResolutionRateData {
  date: string;
  resolved_count: number;
  unresolved_count: number;
  total_count: number;
}

interface DuplicityDetail {
  people_id: string;
  visitor_nickname: string;
  visitor_email: string;
  channels_used: string[];
  distinct_channels: number;
  first_contact: string;
  last_contact: string;
  latest_session_id: string;
}

interface DuplicityData {
  kpi: {
    total_identified_users: number;
    duplicated_users: number;
    duplicity_rate_pct: number;
  };
  details: DuplicityDetail[];
  crispWebsiteId: string;
}

export default function SupportPage() {
  const [mounted, setMounted] = useState(false);
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);
  
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [agentData, setAgentData] = useState<AgentData[]>([]);
  const [effortData, setEffortData] = useState<number | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursData[]>([]);
  const [resolutionRateData, setResolutionRateData] = useState<ResolutionRateData[]>([]);
  const [duplicityData, setDuplicityData] = useState<DuplicityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // API Calls en paralelo
      const [kpiRes, sentimentRes, agentsRes, effortRes, peakRes, rateRes, duplicityRes] = await Promise.all([
        fetch(`/api/kpis/crisp?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/sentiment?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/agents?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/resolution-effort?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/peak-hours?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/resolution-rate?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`),
        fetch(`/api/support/duplicity?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`)
      ]);

      const [kpiJson, sentimentJson, agentsJson, effortJson, peakJson, rateJson, duplicityJson] = await Promise.all([
        kpiRes.json(),
        sentimentRes.json(),
        agentsRes.json(),
        effortRes.json(),
        peakRes.json(),
        rateRes.json(),
        duplicityRes.json()
      ]);

      setKpiData(kpiJson);
      if (sentimentJson.success) setSentimentData(sentimentJson.data);
      if (agentsJson.success) setAgentData(agentsJson.data);
      if (effortJson?.success) setEffortData(effortJson.avgMessages);
      if (peakJson?.success) setPeakHoursData(peakJson.data);
      if (rateJson?.success) setResolutionRateData(rateJson.data);
      if (duplicityJson?.success) setDuplicityData(duplicityJson.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleExportCSV = () => {
    if (!agentData || agentData.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Operador,Tickets Totales,Tickets Resueltos,TTFR Promedio (min),CSAT Promedio\n"
      + agentData.map(a => `${a.operator_name},${a.total_tickets},${a.resolved_tickets},${a.avg_ttfr?.toFixed(1) || 0},${a.avg_csat?.toFixed(1) || 0}`).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rendimiento_soporte_${startDate}_${endDate}.csv`);
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
          <h1 className="text-3xl font-bold text-white tracking-tight">Mensajería CRM</h1>
          <p className="text-zinc-400 mt-1">Chat de soporte Crisp · Análisis de rendimiento, SLA e inteligencia emocional.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
            <CalendarDays className="w-4 h-4 text-zinc-400 ml-2" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [&::-webkit-calendar-picker-indicator]:invert"
            />
            <span className="text-zinc-500">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [&::-webkit-calendar-picker-indicator]:invert"
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KpiCard 
          title="Total Conversaciones" 
          value={loading ? "..." : kpiData?.totalConversations || 0} 
          icon={MessageSquare} 
          color="blue"
        />
        <KpiCard 
          title="Conversaciones Resueltas" 
          value={loading ? "..." : kpiData?.resolvedConversations || 0} 
          icon={MessageCircle} 
          color="emerald"
        />
        <KpiCard 
          title="CSAT Promedio" 
          value={loading ? "..." : (kpiData && kpiData.avgCsat > 0) ? `${kpiData.avgCsat.toFixed(1)}/5` : "N/A"} 
          icon={Star} 
          color="amber"
        />
        <KpiCard 
          title="Esfuerzo (Msjs/Ticket)" 
          value={loading ? "..." : effortData !== null ? effortData : "N/A"} 
          icon={Layers} 
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Sentiment Chart */}
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Smile className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Inteligencia Emocional (NLP)</h2>
              <p className="text-xs text-zinc-400">Análisis de sentimiento diario de los usuarios</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sentimentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="positive_tickets" name="Positivo" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="neutral_tickets" name="Neutral" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="negative_tickets" name="Negativo" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos suficientes para el análisis NLP</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>

        {/* Leaderboard Chart (TTFR) */}
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Tiempos de Respuesta (TTFR)</h2>
              <p className="text-xs text-zinc-400">Promedio de minutos en responder al cliente (SLA)</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : agentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agentData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis type="number" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}m`} />
                  <YAxis type="category" dataKey="operator_name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                  <RechartsTooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)} mins`, 'TTFR Promedio']}
                  />
                  <Bar dataKey="avg_ttfr" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">No hay datos de operadores</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>
      </div>

      {/* New Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Peak Hours Chart */}
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Horarios Pico</h2>
              <p className="text-xs text-zinc-400">Volumen de tickets por hora del día</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              </div>
            ) : peakHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="hourOfDay" 
                    stroke="#52525b" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}:00`}
                  />
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }}
                    labelFormatter={(label) => `Hora: ${label}:00`}
                  />
                  <Bar dataKey="total_tickets" name="Tickets" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">Sin datos de horarios</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>

        {/* Resolution Rate Area Chart */}
        <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Evolución de Resolución</h2>
              <p className="text-xs text-zinc-400">Tickets resueltos vs pendientes por día</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full relative z-10">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : resolutionRateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resolutionRateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorUnresolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
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
                  <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '1rem', color: '#fff' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="resolved_count" name="Resueltos" stroke="#10b981" fillOpacity={1} fill="url(#colorResolved)" stackId="1" />
                  <Area type="monotone" dataKey="unresolved_count" name="Pendientes" stroke="#f43f5e" fillOpacity={1} fill="url(#colorUnresolved)" stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">Sin datos de resolución</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        </div>
      </div>

      {/* Duplicity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <KpiCard 
            title="Tasa de Duplicidad" 
            value={loading ? "..." : duplicityData ? `${duplicityData.kpi.duplicity_rate_pct.toFixed(1)}%` : "N/A"} 
            icon={GitBranch} 
            color="indigo"
          />
        </div>
        <div className="lg:col-span-2 p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Duplicidad Omnicanal</h2>
              <p className="text-xs text-zinc-400">Usuarios en múltiples canales (48h)</p>
            </div>
          </div>
          
          <div className="relative z-10 overflow-x-auto max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              <div className="w-full h-32 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : duplicityData?.details && duplicityData.details.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Usuario</th>
                    <th className="px-4 py-3">Canales</th>
                    <th className="px-4 py-3 text-right">Último Contacto</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicityData.details.map((detail, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex flex-col">
                          <span>{detail.visitor_nickname || 'Anon'}</span>
                          <span className="text-xs text-zinc-500">{detail.visitor_email || 'Sin email'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {detail.channels_used.map(ch => {
                            let color = "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
                            if (ch === 'chat') color = "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
                            if (ch === 'email') color = "bg-blue-500/20 text-blue-400 border-blue-500/30";
                            if (ch === 'whatsapp') color = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                            if (ch === 'instagram') color = "bg-pink-500/20 text-pink-400 border-pink-500/30";
                            if (ch === 'facebook') color = "bg-blue-600/20 text-blue-500 border-blue-600/30";
                            
                            return (
                              <span key={ch} className={cn("text-[10px] px-2 py-0.5 rounded-full border", color)}>
                                {ch}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400 text-xs">
                        {new Date(detail.last_contact).toLocaleString('es', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a 
                          href={`https://app.crisp.chat/website/${duplicityData.crispWebsiteId}/inbox/${detail.latest_session_id}/`} 
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors border border-indigo-500/20"
                          title="Ver en Crisp"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-zinc-500">No se detectaron duplicidades en este período.</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />
        </div>
      </div>

      {/* Agents Table */}
      <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
        <div className="flex items-center gap-2 mb-6 relative z-10">
          <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Rendimiento por Operador</h2>
        </div>
        
        <div className="relative z-10 overflow-x-auto">
          {loading ? (
            <div className="w-full h-32 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
            </div>
          ) : agentData.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Operador</th>
                  <th className="px-4 py-3 text-right">Tickets Atendidos</th>
                  <th className="px-4 py-3 text-right">Resueltos</th>
                  <th className="px-4 py-3 text-right">Tiempo de Rpta. (TTFR)</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">CSAT</th>
                </tr>
              </thead>
              <tbody>
                {agentData.map((agent, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 to-orange-400 flex items-center justify-center text-[10px] font-bold">
                        {agent.operator_name.substring(0, 2).toUpperCase()}
                      </div>
                      {agent.operator_name}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      {agent.total_tickets}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                      {agent.resolved_tickets} ({((agent.resolved_tickets / agent.total_tickets) * 100).toFixed(0)}%)
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-cyan-400">
                      {agent.avg_ttfr ? `${agent.avg_ttfr.toFixed(1)} min` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-400 font-medium flex items-center justify-end gap-1">
                      {agent.avg_csat ? agent.avg_csat.toFixed(1) : '-'} <Star className="w-3 h-3" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="w-full h-32 flex items-center justify-center text-zinc-500">No hay datos de SLA en este período.</div>
          )}
        </div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl" />
      </div>

    </div>
  );
}

// Reusable KPI Card Component
function KpiCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: any, color: 'blue' | 'emerald' | 'amber' | 'violet' | 'indigo' }) {
  const colorStyles = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  };

  return (
    <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl flex flex-col relative overflow-hidden group">
      <div className="flex justify-between items-start relative z-10">
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <div className={cn("p-2 rounded-xl border", colorStyles[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-4 relative z-10 flex items-baseline gap-2">
        <h3 className="text-4xl font-bold text-white tracking-tight">{value}</h3>
      </div>
      {/* Background glow effect */}
      <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500", colorStyles[color].split(' ')[1])} />
    </div>
  );
}
