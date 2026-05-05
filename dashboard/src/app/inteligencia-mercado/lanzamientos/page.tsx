'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, ExternalLink, PackageSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductRelease {
  producto: string;
  marca: string;
  categoria: string;
  estado_db: string;
  especificaciones_clave: string;
  fuente: string;
}

export default function LanzamientosProductosPage() {
  const [data, setData] = useState<ProductRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inteligencia-mercado/lanzamientos');
      if (!res.ok) {
        throw new Error('No se pudo conectar con el servicio de IA.');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error desconocido.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950/40 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            Lanzamientos de Productos
          </h1>
          <p className="text-zinc-400 mt-2">
            Descubre los últimos lanzamientos tecnológicos a nivel global e identifica oportunidades para nuestro catálogo.
          </p>
        </div>
        <button
          onClick={fetchReleases}
          disabled={loading}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <PackageSearch className="w-5 h-5 group-hover:scale-110 transition-transform" />
          )}
          {loading ? 'Consultando a Gemini...' : 'Buscar Nuevos Lanzamientos'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && data.length === 0 && !error && (
        <div className="text-center py-20 bg-zinc-950/40 border border-white/10 rounded-3xl backdrop-blur-md">
          <Sparkles className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white">Ningún dato cargado</h3>
          <p className="text-zinc-400 mt-1">Haz clic en buscar para que el agente de Vertex AI consulte las últimas novedades.</p>
        </div>
      )}

      {/* Data Grid */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((item, idx) => (
            <div 
              key={idx} 
              className={cn(
                "group relative bg-zinc-950/40 border p-6 rounded-3xl backdrop-blur-md transition-all hover:scale-[1.02] duration-300",
                item.estado_db === 'NUEVO LANZAMIENTO' 
                  ? "border-green-500/30 hover:border-green-500/50 shadow-lg hover:shadow-green-500/10" 
                  : "border-white/10 hover:border-white/20"
              )}
            >
              {/* Badge Estado */}
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border">
                {item.estado_db === 'NUEVO LANZAMIENTO' ? (
                  <span className="flex items-center gap-1.5 text-green-400 border-green-500/20 bg-green-500/10">
                    <Sparkles className="w-3 h-3" />
                    Oportunidad
                  </span>
                ) : item.estado_db === 'EXISTENTE' ? (
                  <span className="flex items-center gap-1.5 text-zinc-400 border-zinc-500/20 bg-zinc-500/10">
                    <CheckCircle2 className="w-3 h-3" />
                    En Catálogo
                  </span>
                ) : (
                  <span className="text-yellow-400">{item.estado_db}</span>
                )}
              </div>

              <div className="mt-2 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">{item.marca} • {item.categoria}</div>
                  <h3 className="text-xl font-bold text-white line-clamp-2 leading-tight">{item.producto}</h3>
                </div>
                
                <p className="text-sm text-zinc-400 line-clamp-3">
                  {item.especificaciones_clave}
                </p>

                {item.fuente && (
                  <div className="pt-4 mt-4 border-t border-white/5">
                    <a 
                      href={item.fuente} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ver fuente de noticia
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
