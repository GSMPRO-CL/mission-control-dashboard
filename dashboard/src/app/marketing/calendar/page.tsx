"use client";

import { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';
import { CalendarDays, RefreshCw, AlertCircle, ShoppingBag, Rocket, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface CalendarEvent {
  id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  description: string;
  source: string;
}

interface LaunchEvent {
  id: string;
  producto: string;
  marca: string;
  categoria: string;
  especificaciones_clave: string;
  fuente: string;
  estado_db: string;
  fecha_escaneo: string;
  fecha_lanzamiento: string | null;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function CommercialCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [launches, setLaunches] = useState<LaunchEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, launchesRes] = await Promise.all([
        fetch('/api/marketing/calendar'),
        fetch('/api/inteligencia-mercado/lanzamientos')
      ]);
      
      if (!eventsRes.ok) throw new Error('Error al obtener eventos');
      if (!launchesRes.ok) throw new Error('Error al obtener lanzamientos');
      
      const eventsData = await eventsRes.json();
      const launchesData = await launchesRes.json();
      
      setEvents(eventsData.data || []);
      setLaunches(launchesData.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing/calendar', { method: 'POST' });
      if (!res.ok) throw new Error('Error al sincronizar con Vertex AI');
      await fetchEvents(); // Refetch after successful sync
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha por confirmar';
    const date = new Date(dateString);
    // Add timezone offset to prevent date shifting
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Agrupar eventos por mes
  const groupedEvents = events.reduce((acc: Record<string, CalendarEvent[]>, event) => {
    if (!event.event_date) return acc;
    const date = new Date(event.event_date);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    const monthYear = date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    const capitalized = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
    
    if (!acc[capitalized]) acc[capitalized] = [];
    acc[capitalized].push(event);
    return acc;
  }, {});

  const upcomingLaunches = launches.filter(l => l.estado_db === 'NUEVO LANZAMIENTO' || l.estado_db === 'EXISTENTE');

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-8 pb-20">
      
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-4">
          <Link href="/marketing" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a Marketing
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide uppercase mb-2">
              <CalendarDays className="w-3.5 h-3.5" /> IA Agent Activo
            </div>
            <h2 className="text-4xl font-bold text-white tracking-tight">Calendario Comercial</h2>
            <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed mt-2">
              Monitorea fechas clave, eventos e-commerce y próximos lanzamientos de tecnología a nivel global.
              Datos recopilados de forma inteligente utilizando Vertex AI y Google Search.
            </p>
          </div>
        </div>

        <button 
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-400' : 'text-zinc-400 group-hover:text-white'}`} />
          {syncing ? 'Escaneando Internet...' : 'Forzar Sincronización AI'}
        </button>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">
            <strong className="block font-medium text-red-400 mb-1">Error de sincronización</strong>
            {error}
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-6 h-32 animate-pulse bg-white/5 rounded-2xl border border-white/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Summary / Upcoming Launches */}
          {upcomingLaunches.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="w-5 h-5 text-indigo-400" />
                <h3 className="text-xl font-semibold text-white">Próximos Lanzamientos Destacados</h3>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {upcomingLaunches.slice(0, 8).map((launch, i) => (
                  <div key={launch.id || i} className="snap-start flex-shrink-0 w-72 glass-card p-5 rounded-2xl border border-white/10 hover:border-indigo-500/30 hover:bg-white/5 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110" />
                    
                    <div className="flex items-start justify-between mb-3 relative z-10">
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300">
                        {launch.marca}
                      </span>
                      {launch.fecha_lanzamiento && (
                        <span className="text-xs font-medium text-zinc-400 bg-black/40 px-2 py-1 rounded-md">
                          {formatDate(launch.fecha_lanzamiento)}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-base font-bold text-white mb-2 leading-tight relative z-10">{launch.producto}</h4>
                    <p className="text-zinc-400 text-xs line-clamp-2 mb-4 relative z-10">
                      {launch.especificaciones_clave || 'Sin detalles adicionales'}
                    </p>
                    
                    {launch.fuente && (
                      <a href={launch.fuente} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline relative z-10 line-clamp-1">
                        Fuente: {new URL(launch.fuente).hostname.replace('www.', '')}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {events.length === 0 ? (
            <motion.div variants={itemVariants} className="glass-card p-12 text-center flex flex-col items-center justify-center rounded-2xl border-dashed border-white/10">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No hay eventos próximos</h3>
              <p className="text-zinc-400 max-w-md mx-auto text-sm">
                Actualmente no hay eventos registrados en la base de datos para el futuro. Ejecuta una sincronización para que la Inteligencia Artificial busque nuevos eventos en internet.
              </p>
            </motion.div>
          ) : (
            /* Timeline View */
            <div className="space-y-12">
              {Object.entries(groupedEvents).map(([month, monthEvents], mIdx) => (
                <motion.div variants={itemVariants} key={month} className="relative">
              {/* Month Header */}
              <div className="flex items-center gap-4 mb-6 sticky top-4 z-20">
                <h3 className="text-2xl font-bold text-white bg-black/50 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                  {month}
                </h3>
                <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
              </div>

              {/* Events Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 pl-4 md:pl-8">
                {/* Timeline connector line */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/5 rounded-full ml-[11px] md:ml-[15px]" />
                
                {monthEvents.map((event, eIdx) => {
                  const isLaunch = event.event_type.toLowerCase() === 'launch';
                  return (
                    <div 
                      key={event.id || eIdx} 
                      className="glass-card p-6 relative group hover:border-white/20 transition-all duration-300"
                    >
                      {/* Timeline dot */}
                      <div className={`absolute -left-[29px] md:-left-[41px] top-8 w-3 h-3 rounded-full border-2 border-black ${isLaunch ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                      
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-2.5 rounded-xl border ${
                          isLaunch 
                            ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {isLaunch ? <Rocket className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
                        </div>
                        <span className="text-xs font-medium text-zinc-500 bg-zinc-900/50 px-2.5 py-1 rounded-md border border-white/5">
                          {formatDate(event.event_date)}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-bold text-white mb-2 leading-tight">{event.event_name}</h4>
                      <p className="text-zinc-400 text-sm leading-relaxed mb-4 line-clamp-3">
                        {event.description}
                      </p>
                      
                      {event.source && (
                        <div className="mt-auto pt-4 border-t border-white/5">
                          <a 
                            href={event.source} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors line-clamp-1"
                          >
                            Fuente: {new URL(event.source).hostname.replace('www.', '')}
                          </a>
                        </div>
                      )}
                      
                      {/* Hover glow */}
                      <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none ${isLaunch ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
