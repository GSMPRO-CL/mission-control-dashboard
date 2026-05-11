'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target, Eye, Award, Clock, RefreshCw, Plus, Trash2,
  ShoppingCart, TrendingUp, ExternalLink, Search,
  CheckCircle2, XCircle, CreditCard, Settings, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResultItem {
  position:  number;
  title:     string;
  source:    string;
  price:     string;
  thumbnail: string | null;
  link:      string | null;
  isOurs:    boolean;
}

interface PositionData {
  position:    number | null;
  appeared:    boolean;
  topResults:  ResultItem[];
}

interface ScanResult {
  keyword:   string;
  brand:     string;
  country:   string;
  organic:   PositionData;
  paid:      PositionData;
  scannedAt: string;
  loading?:  boolean;
  error?:    string;
}

type AdType = 'organic' | 'paid';

const COUNTRY_OPTIONS = [
  { label: 'EE.UU.',    value: 'us' },
  { label: 'Chile',     value: 'cl' },
  { label: 'México',    value: 'mx' },
  { label: 'Argentina', value: 'ar' },
  { label: 'Colombia',  value: 'co' },
  { label: 'España',    value: 'es' },
];

const STORAGE_KEYS = { keywords: 'gsmpro_pos_keywords', brand: 'gsmpro_pos_brand', country: 'gsmpro_pos_country' };

// ─── Position Badge ───────────────────────────────────────────────────────────

function PositionBadge({ pos, type }: { pos: number | null; type: AdType }) {
  if (pos === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-500 border border-white/10 rounded-full px-2.5 py-0.5">
        <XCircle className="w-2.5 h-2.5" /> No aparece
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ShoppingPositionPage() {
  const [mounted, setMounted]       = useState(false);
  const [adType, setAdType]         = useState<AdType>('organic');
  const [keywords, setKeywords]     = useState<string[]>([]);
  const [newKw, setNewKw]           = useState('');
  const [brand, setBrand]           = useState('GSMPRO');
  const [country, setCountry]       = useState('us');
  const [results, setResults]       = useState<Record<string, ScanResult>>({});
  const [scanning, setScanning]     = useState(false);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchesLeft, setSearchesLeft] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const kw  = localStorage.getItem(STORAGE_KEYS.keywords);
    const br  = localStorage.getItem(STORAGE_KEYS.brand);
    const co  = localStorage.getItem(STORAGE_KEYS.country);
    if (kw) setKeywords(JSON.parse(kw));
    if (br) setBrand(br);
    if (co) setCountry(co);
  }, [mounted]);

  const persist = (kw: string[], br: string, co: string) => {
    localStorage.setItem(STORAGE_KEYS.keywords, JSON.stringify(kw));
    localStorage.setItem(STORAGE_KEYS.brand,    br);
    localStorage.setItem(STORAGE_KEYS.country,  co);
  };

  const addKeyword = () => {
    const kw = newKw.trim();
    if (!kw || keywords.includes(kw)) return;
    const next = [...keywords, kw];
    setKeywords(next);
    persist(next, brand, country);
    setNewKw('');
  };

  const removeKeyword = (kw: string) => {
    const next = keywords.filter(k => k !== kw);
    setKeywords(next);
    persist(next, brand, country);
    setResults(prev => { const c = { ...prev }; delete c[kw]; return c; });
  };

  const scanOne = useCallback(async (kw: string): Promise<ScanResult | null> => {
    const params = new URLSearchParams({ q: kw, brand, country });
    try {
      const res  = await fetch(`/api/inteligencia-mercado/shopping-position?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSearchesLeft(json.data.rateLimit?.searchesLeft ?? null);
      return json.data;
    } catch (err: any) {
      return { keyword: kw, brand, country, organic: { position: null, appeared: false, topResults: [] }, paid: { position: null, appeared: false, topResults: [] }, scannedAt: new Date().toISOString(), error: err.message };
    }
  }, [brand, country]);

  const scanAll = async () => {
    if (!keywords.length) return;
    setScanning(true);
    setResults(prev => {
      const loading: Record<string, ScanResult> = {};
      for (const kw of keywords) loading[kw] = { ...(prev[kw] ?? { keyword: kw, brand, country, organic: { position: null, appeared: false, topResults: [] }, paid: { position: null, appeared: false, topResults: [] }, scannedAt: '' }), loading: true };
      return loading;
    });
    for (const kw of keywords) {
      const res = await scanOne(kw);
      if (res) setResults(prev => ({ ...prev, [kw]: { ...res, loading: false } }));
    }
    setScanning(false);
  };

  const scanSingle = async (kw: string) => {
    setResults(prev => ({ ...prev, [kw]: { ...(prev[kw] ?? { keyword: kw, brand, country, organic: { position: null, appeared: false, topResults: [] }, paid: { position: null, appeared: false, topResults: [] }, scannedAt: '' }), loading: true } }));
    const res = await scanOne(kw);
    if (res) setResults(prev => ({ ...prev, [kw]: { ...res, loading: false } }));
  };

  const scannedResults = Object.values(results).filter(r => !r.loading && !r.error);
  const appeared       = scannedResults.filter(r => (adType === 'organic' ? r.organic : r.paid).appeared).length;
  const positions      = scannedResults.map(r => (adType === 'organic' ? r.organic : r.paid).position).filter((p): p is number => p !== null);
  const avgPos         = positions.length ? Math.round(positions.reduce((a, b) => a + b, 0) / positions.length * 10) / 10 : null;
  const bestPos        = positions.length ? Math.min(...positions) : null;

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Posicionamiento Shopping</h1>
          <p className="text-zinc-400 mt-1">
            Rastrea tu posición orgánica y pagada en Google Shopping por keyword.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {searchesLeft !== null && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-zinc-950/50 text-sm">
              <CreditCard className="w-4 h-4 text-zinc-500" />
              <span className="text-zinc-400">{searchesLeft.toLocaleString()} créditos</span>
            </div>
          )}
          <button
            onClick={() => setShowSettings(s => !s)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all', showSettings ? 'bg-white/10 border-white/20 text-white' : 'border-white/10 text-zinc-400 hover:text-white hover:bg-white/5')}
          >
            <Settings className="w-4 h-4" />
            Config.
          </button>
          {/* Paid / Organic toggle */}
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

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-5 rounded-2xl border border-white/10 bg-zinc-950/60 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5 block">Nombre de nuestra tienda</label>
            <input
              type="text"
              value={brand}
              onChange={e => { setBrand(e.target.value); persist(keywords, e.target.value, country); }}
              placeholder="ej. GSMPRO, Importadora GSMPRO"
              className="w-full bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
            />
            <p className="text-[10px] text-zinc-600 mt-1">Coincidencia parcial — búsqueda no sensible a mayúsculas</p>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest mb-1.5 block">País</label>
            <select
              value={country}
              onChange={e => { setCountry(e.target.value); persist(keywords, brand, e.target.value); }}
              className="w-full md:w-36 bg-zinc-900/60 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
            >
              {COUNTRY_OPTIONS.map(c => <option key={c.value} value={c.value} className="bg-zinc-900">{c.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Add keyword + Scan All */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={newKw}
            onChange={e => setNewKw(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder='Añadir keyword (ej. "iPhone 15 case")'
            className="w-full bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
        </div>
        <button
          onClick={addKeyword}
          disabled={!newKw.trim()}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 border border-white/10 text-white px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Añadir
        </button>
        <button
          onClick={scanAll}
          disabled={scanning || !keywords.length}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
        >
          <RefreshCw className={cn('w-4 h-4', scanning && 'animate-spin')} />
          {scanning ? 'Escaneando…' : `Escanear todo (${keywords.length})`}
        </button>
      </div>

      {/* KPI summary (only when there are scan results) */}
      {scannedResults.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Keywords rastreadas" value={String(keywords.length)} sub="En tu lista de monitoreo" icon={Target} color="blue" />
          <KpiCard title="Tasa de visibilidad" value={`${Math.round((appeared / scannedResults.length) * 100)}%`} sub={`${adType === 'organic' ? 'Orgánico' : 'Pagado'} · ${appeared} de ${scannedResults.length}`} icon={Eye} color="emerald" />
          <KpiCard title="Mejor posición" value={bestPos ? `#${bestPos}` : '—'} sub="Top ranking actual" icon={Award} color="amber" />
          <KpiCard title="Posición promedio" value={avgPos ? `#${avgPos}` : '—'} sub={`Modo ${adType === 'organic' ? 'orgánico' : 'pagado'}`} icon={Clock} color="violet" />
        </div>
      )}

      {/* Keyword list */}
      {keywords.length === 0 ? (
        <div className="p-16 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <Target className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Sin keywords monitoreadas</h3>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto">
            Añade las keywords de tus productos para ver tu posición en Google Shopping frente a la competencia.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keywords.map(kw => {
            const r        = results[kw];
            const data     = r ? (adType === 'organic' ? r.organic : r.paid) : null;
            const isLoading = r?.loading ?? false;
            const isExpanded = expanded === kw;

            return (
              <div key={kw} className="rounded-2xl border border-white/5 bg-zinc-950/40 overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : kw)}
                    disabled={!data?.topResults?.length}
                    className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
                  </button>

                  {/* Position badge */}
                  {isLoading ? (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-800 text-zinc-500 border border-white/10 rounded-full px-2.5 py-0.5 animate-pulse">
                      Escaneando…
                    </span>
                  ) : data ? (
                    <PositionBadge pos={data.position} type={adType} />
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-zinc-900 text-zinc-600 border border-white/5 rounded-full px-2.5 py-0.5">
                      Sin escanear
                    </span>
                  )}

                  {/* Keyword */}
                  <span className="flex-1 text-white text-sm font-medium">{kw}</span>

                  {/* Competitor info */}
                  {data?.appeared && data.topResults[0] && (
                    <span className="text-zinc-500 text-xs hidden md:block">
                      Top: <span className="text-zinc-300">{data.topResults[0].source}</span>
                    </span>
                  )}

                  {/* Error */}
                  {r?.error && !isLoading && (
                    <span className="text-rose-400 text-xs">{r.error}</span>
                  )}

                  {/* Scan single */}
                  <button
                    onClick={() => scanSingle(kw)}
                    disabled={isLoading}
                    className="text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-30"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                  </button>

                  {/* Remove */}
                  <button onClick={() => removeKeyword(kw)} className="text-zinc-700 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Expanded top results */}
                {isExpanded && data != null && (data.topResults?.length ?? 0) > 0 && (
                  <div className="border-t border-white/5 bg-zinc-900/30 px-4 py-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3">
                      Top resultados {adType === 'organic' ? 'orgánicos' : 'pagados'}
                    </p>
                    <div className="space-y-2">
                      {data.topResults!.map((item, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2 text-xs',
                            item.isOurs ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5',
                          )}
                        >
                          {item.thumbnail && (
                            <img src={item.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover bg-zinc-800 flex-shrink-0" />
                          )}
                          <span className="text-zinc-500 font-mono w-4 flex-shrink-0">#{item.position}</span>
                          <div className="flex-1 min-w-0">
                            <p className={cn('font-medium truncate', item.isOurs ? 'text-blue-300' : 'text-zinc-300')}>
                              {item.source}
                              {item.isOurs && <span className="ml-1.5 text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">Nosotros</span>}
                            </p>
                            <p className="text-zinc-600 truncate">{item.title}</p>
                          </div>
                          <span className="text-zinc-400 font-mono flex-shrink-0">{item.price}</span>
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-zinc-600 hover:text-zinc-300">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

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
