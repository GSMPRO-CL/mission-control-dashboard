"use client";

import { Megaphone, ArrowRight } from "lucide-react";
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function MarketingAdsPage() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10 min-h-[80vh] flex flex-col">
      
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase">
            <Megaphone className="w-3.5 h-3.5" /> Adquisición Pagada
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Ads (Google & Meta)</h2>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Rendimiento de campañas de pauta publicitaria. ROAS, CPA y alcance cruzado entre plataformas.
          </p>
        </div>
      </motion.div>

      {/* Placeholder State */}
      <motion.div variants={itemVariants} className="flex-1 flex items-center justify-center">
        <div className="glass-card max-w-lg w-full p-10 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 relative z-10 border border-blue-500/20">
            <Megaphone className="w-10 h-10 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-3 relative z-10">Módulo en Construcción</h3>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed relative z-10">
            Estamos preparando la integración de datos de Google Ads y Meta Ads. Pronto podrás visualizar el ROI de todas tus campañas en tiempo real.
          </p>
          
          <button className="relative z-10 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors">
            Activar API en GCP <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

    </motion.div>
  );
}
