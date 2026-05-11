'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, ShieldCheck, Globe, ShoppingBag,
  Rocket, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Zap, Activity, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SerpApiAccount {
  searchesLeft: number | null;
  monthlyUsage: number | null;
  monthlyLimit: number | null;
  planName: string;
}

const phases = [
  {
    id: 1,
    name: 'Tendencias',
    description: 'Índice de interés 0-100 por keyword vía Google Trends. Detecta breakouts, estacionalidad y momentum.',
    href: '/inteligencia-mercado/trends',
    icon: TrendingUp,
    status: 'live' as const,
    color: 'emerald',
    cta: 'Explorar Tendencias',
    stat: null,
  },
  {
    id: 2,
    name: 'Competitividad',
    description: 'Compara precios en tiempo real contra la competencia vía Google Shopping (SerpApi).',
    href: '/inteligencia-mercado/competitividad',
    icon: ShieldCheck,
    status: 'live' as const,
    color: 'blue',
    cta: 'Ver Precios',
    stat: null,
  },
  {
    id: 3,
    name: 'Dimensión de Mercado',
    description: 'Market Size y Market Share estimados por producto. Requiere Google Ads Basic Access.',
    href: '/inteligencia-mercado/dimension',
    icon: Globe,
    status: 'pending' as const,
    color: 'amber',
    cta: 'Ver Estado',
    stat: 'Esperando aprobación Google Ads',
  },
  {
    id: 4,
    name: 'Posicionamiento Shopping',
    description: 'Rastrea tu posición orgánica y pagada en Google Shopping keyword por keyword, en tiempo real.',
    href: '/inteligencia-mercado/shopping-position',
    icon: ShoppingBag,
    status: 'live' as const,
    color: 'violet',
    cta: 'Rastrear Posición',
    stat: null,
  },
  {
    id: 5,
    name: 'Lanzamientos',
    description: 'Monitoreo autónomo de novedades del mercado vía Vertex AI. Detecta productos nuevos antes que la competencia.',
    href: '/inteligencia-mercado/lanzamientos',
    icon: Rocket,
    status: 'live' as const,
    color: 'rose',
    cta: 'Ver Lanzamientos',
    stat: null,
  },
];

const statusConfig = {
  live:    { label: 'Activo',   icon: CheckCircle2, classes: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  pending: { label: 'Pendiente', icon: Clock,        classes: 'text-amber-400   bg-amber-500/10   border-amber-500/30'  },
  blocked: { label: 'Bloqueado', icon: AlertTriangle, classes: 'text-rose-400    bg-rose-500/10    border-rose-500/30'   },
};

const colorMap: Record<string, string> = {
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/10',
  blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20    shadow-blue-500/10',
  amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20   shadow-amber-500/10',
  violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20  shadow-violet-500/10',
  rose:    'text-rose-400    bg-rose-500/10    border-rose-500/20    shadow-rose-500/10',
};

const glowMap: Record<string, string> = {
  emerald: 'bg-emerald-500/5',
  blue:    'bg-blue-500/5',
  amber:   'bg-amber-500/5',
  violet:  'bg-violet-500/5',
  rose:    'bg-rose-500/5',
};

export default function MercadoHubPage() {
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<SerpApiAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    fetch('/api/inteligencia-mercado/account')
      .then(r => r.json())
      .then(d => { if (d.success) setAccount(d.data); })
      .catch(() => {})
      .finally(() => setLoadingAccount(false));
  }, [mounted]);

  const liveCount  = phases.filter(p => p.status === 'live').length;
  const creditsPct = account?.monthlyLimit
    ? Math.round(((account.monthlyLimit - (account.monthlyUsage ?? 0)) / account.monthlyLimit) * 100)
    : null;

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Módulo</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Inteligencia de Mercado</h1>
          <p className="text-zinc-400 mt-1 max-w-xl">
            Centro de análisis competitivo: tendencias, precios, dimensión de mercado y posicionamiento en Google Shopping.
          </p>
        </div>

        {/* SerpApi Credits Widget */}
        <div className="flex-shrink-0 p-4 rounded-2xl border border-white/10 bg-zinc-950/60 backdrop-blur-xl min-w-[220px]">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500 font-medium">SerpApi Credits</span>
          </div>
          {loadingAccount ? (
            <div className="h-6 w-24 rounded bg-white/5 animate-pulse" />
          ) : account ? (
            <>
              <p className="text-2xl font-bold text-white">
                {account.searchesLeft?.toLocaleString() ?? '—'}
                <span className="text-sm text-zinc-500 font-normal ml-1">restantes</span>
              </p>
              <div className="mt-2 w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", creditsPct && creditsPct > 30 ? "bg-emerald-500" : creditsPct && creditsPct > 10 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${creditsPct ?? 0}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">{account.planName} · {account.monthlyUsage?.toLocaleString()} usados este mes</p>
            </>
          ) : (
            <p className="text-sm text-zinc-600">Sin datos</p>
          )}
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Módulos activos" value={String(liveCount)} sub={`de ${phases.length} fases`} icon={Activity} color="emerald" />
        <SummaryCard label="Datos en tiempo real" value="SerpApi" sub="Google Trends + Shopping" icon={Zap} color="blue" />
        <SummaryCard label="Google Ads Status" value="Pendiente" sub="Basic Access en revisión" icon={Clock} color="amber" />
        <SummaryCard label="Módulos activos" value={`${liveCount} / ${phases.length}`} sub="Fases implementadas" icon={Rocket} color="violet" />
      </div>

      {/* Phase Cards */}
      <div>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-4">Módulos del sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phases.map(phase => {
            const StatusIcon = statusConfig[phase.status].icon;
            const PhaseIcon  = phase.icon;
            const col        = colorMap[phase.color];
            const glow       = glowMap[phase.color];

            return (
              <Link
                key={phase.id}
                href={phase.href}
                className="group relative p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-xl block"
              >
                {/* Glow */}
                <div className={cn("absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-40 group-hover:opacity-70 transition-opacity", glow)} />

                <div className="relative z-10">
                  {/* Top row */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("p-2.5 rounded-xl border", col.split(' ').slice(0, 3).join(' '))}>
                      <PhaseIcon className="w-5 h-5" />
                    </div>
                    <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border", statusConfig[phase.status].classes)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig[phase.status].label}
                    </span>
                  </div>

                  {/* Phase number */}
                  <p className="text-[10px] font-medium text-zinc-600 mb-1 uppercase tracking-widest">Fase {phase.id}</p>

                  {/* Name + description */}
                  <h3 className="text-lg font-bold text-white mb-2">{phase.name}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-4">{phase.description}</p>

                  {/* Stat if any */}
                  {phase.stat && (
                    <p className="text-xs text-zinc-600 mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500/70" />
                      {phase.stat}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">
                    {phase.cta}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, color, href }: {
  label: string; value: string; sub: string; icon: any;
  color: 'emerald' | 'blue' | 'amber' | 'violet';
  href?: string;
}) {
  const styles: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
    violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20',
  };
  const inner = (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group h-full">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-zinc-400">{label}</p>
        <div className={cn("p-1.5 rounded-lg border", styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>
      <div className={cn("absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity", styles[color].split(' ')[1])} />
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}
