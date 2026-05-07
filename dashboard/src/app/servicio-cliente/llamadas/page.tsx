"use client";

import { useState, useEffect } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, TrendingUp, RefreshCw, Users, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface CallKpis {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  answeredCalls: number;
  missedCalls: number;
  answerRate: number;
  avgDurationMin: number;
}

interface AgentStat {
  name: string;
  total: number;
  answered: number;
  missed: number;
  answerRate: number;
  avgDuration: number;
}

interface HourBucket { hour: string; calls: number; }
interface DayBucket  { date: string; total: number; answered: number; missed: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: any) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth() + 1}`;
};

export default function LlamadasPage() {
  const [mounted,    setMounted]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [kpis,       setKpis]       = useState<CallKpis | null>(null);
  const [agents,     setAgents]     = useState<AgentStat[]>([]);
  const [byHour,     setByHour]     = useState<HourBucket[]>([]);
  const [daily,      setDaily]      = useState<DayBucket[]>([]);

  const now        = new Date();
  const firstDay   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const [dateFrom, setDateFrom] = useState(firstDay.split('T')[0]);
  const [dateTo,   setDateTo]   = useState(now.toISOString().split('T')[0]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (mounted) fetchData(); }, [mounted, dateFrom, dateTo]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res  = await fetch(`/api/servicio-cliente/llamadas?dateFrom=${dateFrom}T00:00:00Z&dateTo=${dateTo}T23:59:59Z`);
      const json = await res.json();

      if (!json.success) {
        setUnconfigured(!!json.unconfigured);
        setErrorMsg(json.error);
        return;
      }
      setUnconfigured(false);
      setKpis(json.data.kpis);
      setAgents(json.data.agentStats);
      setByHour(json.data.byHour);
      setDaily(json.data.dailyTrend);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Llamadas (RingCentral)</h1>
          <p className="text-zinc-400 mt-1">
            Análisis de volumen, tasa de respuesta y rendimiento por agente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [&::-webkit-calendar-picker-indicator]:invert" />
            <span className="text-zinc-500">-</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2 [&::-webkit-calendar-picker-indicator]:invert" />
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Estado: Pendiente de configuración JWT */}
      {unconfigured && (
        <div className="p-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 flex-shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-2">Configuración requerida: JWT Token</h3>
              <p className="text-zinc-400 text-sm mb-4">
                La app RingCentral está registrada. Para completar la integración se necesita
                generar un <strong className="text-white">JWT Token</strong> en el Developer Console:
              </p>
              <ol className="text-zinc-400 text-sm space-y-2 list-decimal list-inside">
                <li>Ingresa a <span className="text-blue-400">developers.ringcentral.com</span></li>
                <li>Abre tu app → pestaña <strong className="text-white">Credentials</strong></li>
                <li>Haz clic en <strong className="text-white">"Create JWT"</strong></li>
                <li>Copia el JWT generado y añádelo a <code className="text-emerald-400 bg-zinc-900 px-1 rounded">env.yaml</code> como <code className="text-emerald-400 bg-zinc-900 px-1 rounded">RINGCENTRAL_JWT_TOKEN</code></li>
                <li>Asegúrate que la app tenga el scope <strong className="text-white">ReadCallLog</strong></li>
              </ol>
              <div className="mt-4 p-3 bg-zinc-900/60 rounded-xl border border-white/5">
                <p className="text-xs text-zinc-500 mb-1">Variables requeridas en env.yaml:</p>
                <pre className="text-xs text-emerald-400">{`RINGCENTRAL_CLIENT_ID: "22z6PTLnccibRrVtF8gXTZ"
RINGCENTRAL_CLIENT_SECRET: "bEp2q...CCfN"
RINGCENTRAL_SERVER: "https://platform.ringcentral.com"
RINGCENTRAL_JWT_TOKEN: "<pegar aquí el JWT generado>"`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estado: Error genérico */}
      {errorMsg && !unconfigured && (
        <div className="p-6 rounded-3xl border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* KPIs */}
      {kpis && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="Total Llamadas"     value={String(kpis.totalCalls)}      icon={Phone}         color="blue" />
            <KpiCard title="Entrantes"          value={String(kpis.inboundCalls)}    icon={PhoneIncoming}  color="emerald" />
            <KpiCard title="Tasa de Respuesta"  value={`${kpis.answerRate}%`}        icon={TrendingUp}     color="violet" />
            <KpiCard title="Dur. Promedio"      value={`${kpis.avgDurationMin} min`} icon={Clock}          color="amber" />
          </div>

          {/* Sub-KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Llamadas Contestadas', value: kpis.answeredCalls, color: 'text-emerald-400' },
              { label: 'Llamadas Perdidas',    value: kpis.missedCalls,   color: 'text-rose-400' },
              { label: 'Salientes',            value: kpis.outboundCalls, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-2xl border border-white/5 bg-zinc-900/40 text-center">
                <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
                <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Tendencia diaria */}
            <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white mb-1">Tendencia Diaria</h2>
              <p className="text-xs text-zinc-400 mb-6">Llamadas totales, contestadas y perdidas por día</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false}
                      tickFormatter={fmtDate} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', fontSize: '12px', color: '#fff' }}
                      labelFormatter={fmtDate}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Line type="monotone" dataKey="total"    name="Total"      stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="answered" name="Contestadas" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="missed"   name="Perdidas"    stroke="#f43f5e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribución por hora */}
            <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white mb-1">Volumen por Hora</h2>
              <p className="text-xs text-zinc-400 mb-6">Distribución horaria de llamadas entrantes</p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byHour} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="hour" stroke="#52525b" fontSize={10} tickLine={false}
                      interval={3} />
                    <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '1rem', fontSize: '12px', color: '#fff' }}
                    />
                    <Bar dataKey="calls" name="Llamadas" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabla de agentes */}
          {agents.length > 0 && (
            <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-white">Rendimiento por Agente</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Agente</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Contestadas</th>
                      <th className="px-4 py-3 text-right">Perdidas</th>
                      <th className="px-4 py-3 text-right">Tasa Resp.</th>
                      <th className="px-4 py-3 text-right rounded-tr-lg">Dur. Prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white font-medium flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {a.name.substring(0, 2).toUpperCase()}
                          </div>
                          {a.name}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300 font-mono">{a.total}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-mono">{a.answered}</td>
                        <td className="px-4 py-3 text-right text-rose-400 font-mono">{a.missed}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("font-semibold", a.answerRate >= 80 ? "text-emerald-400" : a.answerRate >= 60 ? "text-amber-400" : "text-rose-400")}>
                            {a.answerRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400 font-mono">{a.avgDuration} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Skeleton de carga */}
      {loading && !errorMsg && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-28 rounded-3xl bg-zinc-900/50 border border-white/5 animate-pulse" />
          ))}
        </div>
      )}

    </div>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────────────────
function KpiCard({ title, value, icon: Icon, color }: {
  title: string; value: string; icon: any;
  color: 'blue' | 'emerald' | 'violet' | 'amber';
}) {
  const styles = {
    blue:    'text-blue-400   bg-blue-500/10   border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    violet:  'text-violet-400 bg-violet-500/10 border-violet-500/20',
    amber:   'text-amber-400  bg-amber-500/10  border-amber-500/20',
  };
  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3 relative z-10">
        <p className="text-xs font-medium text-zinc-400 leading-tight">{title}</p>
        <div className={cn("p-1.5 rounded-lg border", styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight relative z-10">{value}</p>
      <div className={cn("absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity", styles[color].split(' ')[1])} />
    </div>
  );
}
