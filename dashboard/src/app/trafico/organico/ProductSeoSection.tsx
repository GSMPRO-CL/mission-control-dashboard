'use client';

import { useState } from 'react';
import { Search, Sparkles, TrendingUp, Eye, MousePointerClick, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

export function ProductSeoSection({ startDate, endDate }: { startDate: string, endDate: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  
  // States for Position Data
  const [positionData, setPositionData] = useState<any | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);

  // States for AI Inspector
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [selectedMetric, setSelectedMetric] = useState('Todas');

  const handleSearch = async (val: string) => {
    setSearchTerm(val);
    if (val.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/trafico/organico/product-search?q=${encodeURIComponent(val)}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data);
        setShowDropdown(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setSearchTerm('');
    setShowDropdown(false);
    setInspectionResult(null); // Reset AI result when selecting new product
    
    // Fetch Position Data
    setIsLoadingPosition(true);
    try {
      const res = await fetch(`/api/trafico/organico/product-position?productId=${product.id}&startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) {
        setPositionData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPosition(false);
    }
  };

  const handleRunInspector = async () => {
    if (!selectedProduct) return;
    
    setIsInspecting(true);
    setInspectionResult(null);
    try {
      const res = await fetch('/api/trafico/organico/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          metric: selectedMetric,
          startDate,
          endDate
        })
      });
      const json = await res.json();
      if (json.success) {
        setInspectionResult(json.data.analysis);
      } else {
        alert("Error al ejecutar el Inspector AI: " + json.error);
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión con el Inspector AI.");
    } finally {
      setIsInspecting(false);
    }
  };

  const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);
  const formatPercent = (val: number) => `${val.toFixed(2)}%`;
  const formatPos = (val: number) => val.toFixed(1);

  return (
    <div className="space-y-6">
      
      {/* Selector de Producto */}
      <div className="p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative z-20">
        <h2 className="text-xl font-bold text-white mb-1">Posicionamiento por Producto</h2>
        <p className="text-sm text-zinc-400 mb-6">Busca un producto para ver su rendimiento SEO específico.</p>
        
        <div className="relative w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar producto por nombre o handle..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            )}
          </div>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
              <ul className="max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <li 
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors"
                  >
                    <p className="text-sm font-medium text-white">{p.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Handle: {p.handle}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Resultados de Posicionamiento */}
      {selectedProduct && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex items-center gap-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{selectedProduct.title}</h3>
              <p className="text-sm text-blue-400/80">Resultados del {startDate} al {endDate}</p>
            </div>
          </div>

          {isLoadingPosition ? (
            <div className="h-40 flex items-center justify-center border border-white/5 rounded-xl bg-zinc-900/30">
              <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : positionData ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* KPIs del Producto */}
              <div className="lg:col-span-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50">
                    <p className="text-xs text-zinc-400 mb-1">Posición Promedio</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      positionData.kpis.position > 0 && positionData.kpis.position <= 10 ? "text-emerald-400" :
                      positionData.kpis.position > 10 && positionData.kpis.position <= 30 ? "text-amber-400" :
                      positionData.kpis.position > 30 ? "text-rose-400" : "text-zinc-500"
                    )}>
                      {positionData.kpis.position > 0 ? formatPos(positionData.kpis.position) : 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50">
                    <p className="text-xs text-zinc-400 mb-1">CTR</p>
                    <p className="text-2xl font-bold text-amber-400">{formatPercent(positionData.kpis.ctr)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50">
                    <p className="text-xs text-zinc-400 mb-1">Impresiones</p>
                    <p className="text-2xl font-bold text-blue-400">{formatNumber(positionData.kpis.impressions)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50">
                    <p className="text-xs text-zinc-400 mb-1">Clics</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatNumber(positionData.kpis.clicks)}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/50 overflow-hidden">
                  <h4 className="text-sm font-semibold text-white mb-3">Top 5 Queries</h4>
                  <div className="space-y-3">
                    {positionData.topQueries.slice(0, 5).map((q: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 truncate pr-2 max-w-[150px]" title={q.query}>{q.query}</span>
                        <div className="flex items-center gap-3 text-right">
                          <span className="text-emerald-400">{q.clicks} clics</span>
                          <span className="text-zinc-500 w-12">Pos {formatPos(q.position)}</span>
                        </div>
                      </div>
                    ))}
                    {positionData.topQueries.length === 0 && (
                      <p className="text-xs text-zinc-500">Sin datos de queries orgánicas.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Inspector AI */}
              <div className="lg:col-span-2 p-6 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 relative overflow-hidden group">
                <div className="flex items-start justify-between mb-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <h3 className="text-xl font-bold text-white">Inspector AI de Métricas</h3>
                    </div>
                    <p className="text-sm text-zinc-400">Analiza el SEO On-Page y rendimiento para generar mejoras.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select 
                      value={selectedMetric}
                      onChange={(e) => setSelectedMetric(e.target.value)}
                      className="bg-zinc-900 border border-white/10 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="Todas">Analizar Todas</option>
                      <option value="CTR">Analizar CTR</option>
                      <option value="Posición Promedio">Analizar Posición</option>
                    </select>
                    <button 
                      onClick={handleRunInspector}
                      disabled={isInspecting || positionData.kpis.impressions === 0}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                      {isInspecting ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analizando...</>
                      ) : (
                        <><Sparkles className="w-4 h-4" /> Ejecutar IA</>
                      )}
                    </button>
                  </div>
                </div>

                <div className="relative z-10">
                  {!inspectionResult && !isInspecting && (
                    <div className="h-48 border border-dashed border-indigo-500/30 rounded-xl flex flex-col items-center justify-center text-center p-6">
                      <Sparkles className="w-8 h-8 text-indigo-400/50 mb-3" />
                      <p className="text-sm text-indigo-300">Haz clic en "Ejecutar IA" para escanear el HTML y las métricas de este producto.</p>
                      {positionData.kpis.impressions === 0 && (
                        <p className="text-xs text-rose-400 mt-2">El producto no tiene impresiones orgánicas en este periodo. La IA necesita datos de GSC para trabajar.</p>
                      )}
                    </div>
                  )}

                  {isInspecting && (
                    <div className="h-48 border border-indigo-500/20 rounded-xl bg-zinc-900/50 flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                      <p className="text-sm text-indigo-300 font-medium">Gemini 2.5 Pro está analizando la URL y métricas...</p>
                      <p className="text-xs text-zinc-500 mt-1">Este proceso tarda aprox 10-15 segundos.</p>
                    </div>
                  )}

                  {inspectionResult && !isInspecting && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500 max-h-[500px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-indigo-500/30 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-indigo-500/50">
                      <div className="p-4 rounded-xl bg-zinc-900/80 border border-white/10">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Diagnóstico</h4>
                        <p className="text-sm text-white leading-relaxed">{inspectionResult.diagnostico}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Hipótesis</h4>
                          <ul className="space-y-2">
                            {inspectionResult.hipotesis?.map((h: string, i: number) => (
                              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                <span className="text-indigo-400 mt-0.5">•</span>
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5">
                          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Métricas Críticas</h4>
                          <div className="space-y-3">
                            {inspectionResult.metricas_criticas?.map((m: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-zinc-400">{m.nombre}</span>
                                <div className="text-right">
                                  <span className="text-white font-medium">{m.valor_actual}</span>
                                  <span className="text-zinc-600 mx-1">→</span>
                                  <span className="text-emerald-400">{m.valor_ideal}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Recomendaciones de Acción</h4>
                        <div className="space-y-2">
                          {inspectionResult.recomendaciones?.map((r: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-zinc-900 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <p className="text-sm text-zinc-200">{r.accion}</p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                  r.impacto_esperado?.toLowerCase() === 'alto' ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                                )}>
                                  Impacto {r.impacto_esperado}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                  r.esfuerzo?.toLowerCase() === 'bajo' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                )}>
                                  Esfuerzo {r.esfuerzo}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl opacity-50 pointer-events-none" />
              </div>

            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
