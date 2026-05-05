import { AlertTriangle, Share2 } from 'lucide-react';

export default function TraficoMetaAdsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Tráfico Pagado (Meta Ads)</h1>
        <p className="text-zinc-400 mt-1">Rendimiento de campañas en Facebook e Instagram.</p>
      </div>

      <div className="w-full min-h-[500px] p-12 rounded-2xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl flex flex-col items-center justify-center text-center relative overflow-hidden group">
        {/* Meta signature colors for the ambient glow */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-[#0668E1]/20 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#E1306C]/10 rounded-full blur-3xl opacity-50" />
        
        <div className="bg-zinc-950/50 p-6 rounded-2xl border border-white/5 shadow-2xl relative z-10 max-w-md">
          <div className="mx-auto w-16 h-16 bg-[#0668E1]/20 text-[#0668E1] flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Share2 className="w-8 h-8" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3">Módulo en Construcción</h2>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Estamos diseñando la arquitectura de datos para extraer métricas de Facebook e Instagram Ads hacia BigQuery. 
            Muy pronto podrás unificar todo tu gasto publicitario en un solo panel.
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-[#0668E1] bg-[#0668E1]/10 py-3 px-4 rounded-xl border border-[#0668E1]/20">
            <AlertTriangle className="w-4 h-4" />
            <span>Fase de desarrollo de integraciones externas.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
