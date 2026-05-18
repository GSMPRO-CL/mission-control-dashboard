'use client';

import { useState, useEffect } from 'react';
import {
  Target, Eye, Award, Clock, TrendingUp, TrendingDown, Minus, ShoppingCart, X, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

interface PositionHistory {
  scan_date: string;
  organic_position: number | null;
  paid_position: number | null;
}

interface PositionData {
  keyword: string;
  product_id: number;
  organic_position: number | null;
  paid_position: number | null;
  top_competitor_name: string | null;
  top_competitor_price: number | null;
  scan_date: string | null;
  scraped_at: string | null;
  prev_organic_position: number | null;
  prev_paid_position: number | null;
  history: PositionHistory[];
}

type AdType = 'organic' | 'paid';

function TrendIndicator({ current, prev }: { current: number | null; prev: number | null }) {
  if (current === null && prev === null) return null;
  if (current === null && prev !== null) {
    return <span className="text-rose-400 flex items-center text-[10px] gap-0.5"><TrendingDown className="w-3 h-3" /> Perdió ranking</span>;
  }
  if (current !== null && prev === null) {
    return <span className="text-emerald-400 flex items-center text-[10px] gap-0.5"><TrendingUp className="w-3 h-3" /> Nuevo ranking</span>;
  }
  if (current! < prev!) {
    return <span className="text-emerald-400 flex items-center text-[10px] gap-0.5"><TrendingUp className="w-3 h-3" /> +{prev! - current!} pos</span>;
  }
  if (current! > prev!) {
    return <span className="text-rose-400 flex items-center text-[10px] gap-0.5"><TrendingDown className="w-3 h-3" /> {prev! - current!} pos</span>;
  }
  return <span className="text-zinc-500 flex items-center text-[10px] gap-0.5"><Minus className="w-3 h-3" /> Sin cambios</span>;
}

function PositionBadge({ pos, type }: { pos: number | null; type: AdType }) {
  if (pos === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-500 border border-white/10 rounded-full px-2.5 py-0.5">
        No aparece
      </span>
    );
  }
  const gold   = 'bg-amber-500/20   text-amber-300   border-amber-500/40';
  const silver = 'bg-zinc-400/20    text-zinc-200    border-zinc-400/40';
  const bronze = 'bg-orange-700/20  text-orange-400  border-orange-700/40';
  const blue   = 'bg-blue-500/10    text-blue-300    border-blue-500/20';
  const green  = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  const cls = pos === 1 ? gold : pos === 2 ? silver : pos === 3 ? bronze : type === 'paid' ? blue : green;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono font-bold border rounded-full px-2.5 py-0.5', cls)}>
      {pos <= 3 && <Award className="w-2.5 h-2.5" />}
      #{pos}
    </span>
  );
}

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length === 0) return <div className="w-24 h-8 bg-zinc-900/50 rounded animate-pulse" />;
  
  return (
    <div className="w-24 h-10 cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center group relative">
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
      <ResponsiveContainer width="100%" height="80%">
        <LineChart data={data}>
          <YAxis reversed domain={[1, 'dataMax']} hide />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2} 
            dot={false} 
            connectNulls={true}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function HistoryModal({ 
  isOpen, 
  onClose, 
  keyword, 
  data, 
  adType 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  keyword: string; 
  data: PositionHistory[];
  adType: AdType;
}) {
  if (!isOpen) return null;

  const dataKey = adType === 'organic' ? 'organic_position' : 'paid_position';
  const color = adType === 'organic' ? '#10b981' : '#3b82f6';

  const validPositions = data.map(d => d[dataKey as keyof PositionHistory]).filter(p => p !== null) as number[];
  const maxPos = validPositions.length > 0 ? Math.max(...validPositions) : 10;
  const domainMax = Math.max(10, Math.ceil(maxPos / 10) * 10);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col scale-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-zinc-400" />
              Historial de Posicionamiento
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Evolución de ranking para <span className="text-white font-medium">"{keyword}"</span> ({adType === 'organic' ? 'Orgánico' : 'Pagado'})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 h-[400px]">
          {validPositions.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-500">
              No hay datos históricos registrados para este tipo de anuncio.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis 
                  dataKey="scan_date" 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  tickMargin={10} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  reversed 
                  domain={[1, domainMax]} 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => `#${val}`}
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => [`Posición #${value}`, 'Ranking']}
                  labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey={dataKey} 
                  stroke={color} 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#18181b' }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                  connectNulls={true}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShoppingPositionPage() {
  const [data, setData] = useState<PositionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adType, setAdType] = useState<AdType>('organic');
  const [selectedProduct, setSelectedProduct] = useState<{keyword: string, history: PositionHistory[]} | null>(null);

  useEffect(() => {
    fetch('/api/inteligencia-mercado/shopping-position')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json.data);
        else setError(json.error);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const appeared  = data.filter(r => (adType === 'organic' ? r.organic_position : r.paid_position) !== null).length;
  const positions = data.map(r => (adType === 'organic' ? r.organic_position : r.paid_position)).filter((p): p is number => p !== null);
  const avgPos    = positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length * 10) / 10 : null;
  const bestPos   = positions.length ? Math.min(...positions) : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Posicionamiento Shopping</h1>
          <p className="text-zinc-400 mt-1">
            Top 30 productos con mayor tracción. Datos actualizados automáticamente.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-zinc-900/60 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setAdType('organic')}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                adType === 'organic' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-zinc-400 hover:text-white')}
            >
              <TrendingUp className="w-3 h-3" /> Orgánico
            </button>
            <button
              onClick={() => setAdType('paid')}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5',
                adType === 'paid' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-zinc-400 hover:text-white')}
            >
              <ShoppingCart className="w-3 h-3" /> Pagado
            </button>
          </div>
        </div>
      </div>

      {!loading && !error && data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Productos rastreados" value={String(data.length)} sub="Top 30 (ventas 30d)" icon={Target} color="blue" />
          <KpiCard title="Tasa de visibilidad" value={`${Math.round((appeared / data.length) * 100)}%`} sub={`${adType === 'organic' ? 'Orgánico' : 'Pagado'} · ${appeared} de ${data.length}`} icon={Eye} color="emerald" />
          <KpiCard title="Mejor posición" value={bestPos ? `#${bestPos}` : '—'} sub="Top ranking actual" icon={Award} color="amber" />
          <KpiCard title="Posición promedio" value={avgPos ? `#${avgPos}` : '—'} sub={`Modo ${adType === 'organic' ? 'orgánico' : 'pagado'}`} icon={Clock} color="violet" />
        </div>
      )}

      {loading ? (
        <div className="p-16 text-center text-zinc-500 animate-pulse">Cargando datos históricos...</div>
      ) : error ? (
        <div className="p-16 text-center text-rose-500 bg-rose-500/10 rounded-2xl border border-rose-500/20">{error}</div>
      ) : data.length === 0 ? (
        <div className="p-16 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin datos disponibles</h3>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto">
            El proceso automático de escaneo aún no ha insertado registros.
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900/40 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/60 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wider">Producto (Keyword)</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Posición {adType === 'organic' ? 'Orgánica' : 'Pagada'}</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-center">Tendencia</th>
                <th className="px-6 py-4 font-semibold tracking-wider">Top Competidor</th>
                <th className="px-6 py-4 font-semibold tracking-wider text-right">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((item, idx) => {
                const currentPos = adType === 'organic' ? item.organic_position : item.paid_position;
                const prevPos = adType === 'organic' ? item.prev_organic_position : item.prev_paid_position;
                return (
                  <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{item.keyword}</div>
                      <div className="text-xs text-zinc-500 font-mono mt-0.5">ID: {item.product_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <PositionBadge pos={currentPos} type={adType} />
                        <TrendIndicator current={currentPos} prev={prevPos} />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center" onClick={() => setSelectedProduct({ keyword: item.keyword, history: item.history || [] })}>
                        <Sparkline 
                          data={item.history || []} 
                          dataKey={adType === 'organic' ? 'organic_position' : 'paid_position'} 
                          color={adType === 'organic' ? '#10b981' : '#3b82f6'} 
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.top_competitor_name ? (
                        <div>
                          <div className="text-zinc-300 font-medium">{item.top_competitor_name}</div>
                          {item.top_competitor_price && (
                            <div className="text-xs text-zinc-500 mt-0.5">${item.top_competitor_price.toLocaleString()}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-zinc-400">{item.scan_date}</div>
                      {item.scraped_at && (
                        <div className="text-xs text-zinc-600 mt-0.5">
                          {new Date(item.scraped_at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <HistoryModal 
        isOpen={selectedProduct !== null} 
        onClose={() => setSelectedProduct(null)} 
        keyword={selectedProduct?.keyword || ''} 
        data={selectedProduct?.history || []} 
        adType={adType} 
      />
    </div>
  );
}

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub: string; icon: any;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
}) {
  const styles: Record<string, string> = {
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
    violet:  'text-violet-400  bg-violet-500/10  border-violet-500/20',
  };
  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-zinc-400 leading-tight">{title}</p>
        <div className={cn('p-1.5 rounded-lg border', styles[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-[10px] text-zinc-500 mt-1">{sub}</p>
      <div className={cn('absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity', styles[color].split(' ')[1])} />
    </div>
  );
}
