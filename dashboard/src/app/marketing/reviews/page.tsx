"use client";

import { useState, useEffect } from 'react';
import { Star, MessageSquare, TrendingUp, ThumbsUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function MarketingReviewsPage() {
  const [yotpoData, setYotpoData] = useState<any>({
    averageRating: "0.0",
    totalReviews: 0,
    publishedReviews: 0,
    pendingReviews: 0,
    sentimentScore: 0,
    ratingDistribution: [
      { name: '5 Estrellas', value: 0, color: '#f59e0b' },
      { name: '4 Estrellas', value: 0, color: '#fbbf24' },
      { name: '3 Estrellas', value: 0, color: '#fcd34d' },
      { name: '2 Estrellas', value: 0, color: '#f87171' },
      { name: '1 Estrella', value: 0, color: '#ef4444' }
    ]
  });
  const [loadingYotpo, setLoadingYotpo] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoadingYotpo(true);
      try {
        const res = await fetch('/api/kpis/yotpo');
        const json = await res.json();
        if (json.success) {
          setYotpoData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingYotpo(false);
      }
    }
    fetchData();
  }, []);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-10">
      
      {/* Header Section */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Star className="w-3.5 h-3.5" /> Social Proof
          </div>
          <h2 className="text-4xl font-bold text-white tracking-tight">Reseñas y Satisfacción (Yotpo)</h2>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Análisis de retroalimentación de clientes, puntuaciones promedio y sentimiento generado a través de reseñas post-compra.
          </p>
        </div>
      </motion.div>

      {/* Social Proof Metrics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Average Rating KPI */}
        <div className="glass-card flex flex-col justify-between p-6 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110 group-hover:-rotate-12">
            <Star className="w-24 h-24 text-amber-400" />
          </div>
          <div className="z-10">
            <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Calificación Promedio</h3>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-amber-100 to-amber-500">
                {yotpoData.averageRating}
              </p>
              <span className="text-zinc-500 font-medium mb-1.5">/ 5.0</span>
            </div>
          </div>
          <div className="mt-6 w-full bg-white/5 h-1.5 rounded-full overflow-hidden z-10">
            <div className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full transition-all duration-1000" style={{ width: `${(Number(yotpoData.averageRating)/5)*100}%` }} />
          </div>
        </div>

        {/* Reviews Status KPI */}
        <div className="glass-card flex flex-col justify-between p-6">
          <div>
            <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-500" /> Atribución de Reseñas</h3>
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex items-end justify-between pb-2 border-b border-white/5">
                <span className="text-zinc-400 text-sm">Totales</span>
                <span className="text-2xl font-bold text-white">{yotpoData.totalReviews.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex items-end justify-between pt-1">
                <span className="text-emerald-400/90 text-sm flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aprobadas</span>
                <span className="text-lg font-medium text-emerald-400">{yotpoData.publishedReviews.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-amber-400/90 text-sm flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pendientes</span>
                <span className="text-lg font-medium text-amber-400">{yotpoData.pendingReviews.toLocaleString('es-CL')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sentiment Score KPI */}
        <div className="glass-card flex flex-col justify-between p-6">
          <div>
            <h3 className="text-zinc-400 font-medium text-sm flex items-center gap-2"><ThumbsUp className="w-4 h-4 text-blue-500" /> Sentiment Score</h3>
            <div className="mt-4">
              <p className="text-4xl font-bold text-white">{yotpoData.sentimentScore}<span className="text-2xl text-zinc-500 ml-1">%</span></p>
            </div>
          </div>
          <p className="mt-6 text-xs text-zinc-400">Puntaje basado en NLP de comentarios positivos vs negativos.</p>
        </div>

        {/* Distribution Chart */}
        <div className="glass-card p-5 flex flex-col">
          <h3 className="text-zinc-400 font-medium text-xs mb-4 uppercase tracking-wider">Distribución de Estrellas</h3>
          <div className="flex-1 w-full min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yotpoData.ratingDistribution} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={8}>
                  {yotpoData.ratingDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
