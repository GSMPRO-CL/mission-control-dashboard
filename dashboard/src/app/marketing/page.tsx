"use client";

import Link from 'next/link';
import { BarChart3, Mail, Star, Search, Megaphone, ArrowRight } from "lucide-react";
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function MarketingOverviewPage() {
  const modules = [
    {
      title: 'Email & Retención',
      description: 'Métricas de campañas, flujos e ingresos atribuidos vía Klaviyo.',
      icon: Mail,
      href: '/marketing/email',
      color: 'rose'
    },
    {
      title: 'Reseñas & Social Proof',
      description: 'Análisis de calificación promedio y sentimiento vía Yotpo.',
      icon: Star,
      href: '/marketing/reviews',
      color: 'amber'
    },
    {
      title: 'Tráfico Orgánico (SEO)',
      description: 'Adquisición, clics e impresiones en motores de búsqueda vía GSC.',
      icon: Search,
      href: '/trafico/organico',
      color: 'indigo'
    },
    {
      title: 'Ads (Adquisición Pagada)',
      description: 'Rendimiento de pauta y ROAS en Google Ads y Meta Ads. (Próximamente)',
      icon: Megaphone,
      href: '/marketing/ads',
      color: 'blue'
    }
  ];

  const colorStyles: Record<string, string> = {
    rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-500/20',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20'
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
      
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/50 border border-white/10 text-zinc-300 text-xs font-semibold tracking-wide uppercase">
            <BarChart3 className="w-3.5 h-3.5" /> Intelligence Center
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Marketing Overview</h2>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Bienvenido al panel central de Marketing. Selecciona un módulo para profundizar en las métricas de rendimiento comercial.
          </p>
        </div>
      </motion.div>

      {/* Navigation Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((mod, idx) => (
          <Link href={mod.href} key={idx}>
            <div className="glass-card group p-6 flex flex-col h-full relative overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/[0.02] cursor-pointer">
              <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-3 rounded-xl border transition-colors duration-300 ${colorStyles[mod.color]}`}>
                  <mod.icon className="w-6 h-6 drop-shadow-md" />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:translate-x-1 transition-all duration-300">
                  <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white" />
                </div>
              </div>
              <div className="relative z-10 mt-auto">
                <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">{mod.title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{mod.description}</p>
              </div>
              {/* Subtle background glow on hover */}
              <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${colorStyles[mod.color].split(' ')[0]}`} />
            </div>
          </Link>
        ))}
      </motion.div>

    </motion.div>
  );
}
