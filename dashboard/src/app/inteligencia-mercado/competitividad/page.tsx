'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck, TrendingDown, TrendingUp, Search,
  RefreshCw, ExternalLink, Star, Truck, CreditCard,
  CheckCircle2, XCircle, AlertCircle, Save, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Competitor {
  title:          string;
  source:         string;
  price:          string;
  extractedPrice: number;
  thumbnail:      string | null;
  link:           string | null;
  rating:         number | null;
  reviews:        number | null;
  delivery:       string | null;
  condition:      string;
  diffAmount:     number | null;
  diffPct:        number | null;
  isCompetitive:  boolean | null;
}

interface Summary {
  total:               number;
  lowestCompetitor:    number | null;
  highestCompetitor:   number | null;
  avgCompetitor:       number | null;
  competitivenessRate: number | null;
}

interface TopProduct {
  id: number;
  title: string;
  total_sold: number;
  our_price: number | null;
  avg_competitor_price: number | null;
  min_competitor_price: number | null;
}

interface ApiResult {
  query:          string;
  ourPrice:       number | null;
  ourBasePrice:   number | null;
  targetCurrency: string;
  exchangeRate:   number;
  competitors:    Competitor[];
  summary:        Summary;
  rateLimit:      { searchesLeft: number | null; planName: string };
  fetchedAt:      string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (n: number, currency: string = 'USD') => {
  try {
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency, 
      maximumFractionDigits: ['CLP', 'COP', 'ARS'].includes(currency) ? 0 : 2 
    }).format(n);
  } catch (e) {
    return `$${n}`;
  }
};

const COUNTRY_OPTIONS = [
  { label: 'EE.UU.',    value: 'us' },
  { label: 'Chile',     value: 'cl' },
  { label: 'México',    value: 'mx' },
  { label: 'Argentina', value: 'ar' },
  { label: 'Colombia',  value: 'co' },
  { label: 'España',    value: 'es' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompetitividadPage() {
  const [mounted, setMounted]           = useState(false);
  const [query, setQuery]               = useState('');
  const [ourPrice, setOurPrice]         = useState('');
  const [country, setCountry]           = useState('us');
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState<ApiResult | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [searchesLeft, setSearchesLeft] = useState<number | null>(null);

  // Autocomplete State
  const [suggestions, setSuggestions]         = useState<{id: string; title: string; price: number}[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTimeout, setSearchTimeout]     = useState<NodeJS.Timeout | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Save State
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Top Products State
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => { 
    setMounted(true); 
    fetchTopProducts();
  }, []);

  const fetchTopProducts = async () => {
    try {
      setLoadingTop(true);
      const res = await fetch('/api/inteligencia-mercado/top-20');
      const json = await res.json();
      if (json.success) {
        setTopProducts(json.data);
      }
    } catch (e) {
      console.error('Error fetching top 20', e);
    } finally {
      setLoadingTop(false);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/productos/search?q=${encodeURIComponent(val)}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          setSuggestions(json.data);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (e) {
        console.error(e);
      }
    }, 400);
    
    setSearchTimeout(timeout);
  };

  const selectSuggestion = (suggestion: {id: string; title: string; price: number}) => {
    setQuery(suggestion.title);
    setOurPrice(suggestion.price.toString());
    setSelectedProductId(suggestion.id);
    setShowSuggestions(false);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaveMessage(null);

    try {
      const params = new URLSearchParams({ q, country });
      if (ourPrice) params.set('our_price', ourPrice);

      const res  = await fetch(`/api/inteligencia-mercado/competitividad?${params}`);
      const json = await res.json();

      if (!json.success) throw new Error(json.error);
      setResult(json.data);
      setSearchesLeft(json.data.rateLimit?.searchesLeft ?? null);
    } catch (err: any) {
      setError(err.message ?? 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const res = await fetch('/api/inteligencia-mercado/competitividad/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          title: result.query,
          ourPrice: result.ourPrice,
          keyword: result.query,
          competitors: result.competitors
        })
      });
      const json = await res.json();
      if (json.success) {
        setSaveMessage({ type: 'success', text: 'Resultados guardados exitosamente en BigQuery.' });
        fetchTopProducts();
      } else {
        throw new Error(json.error);
      }
    } catch (e: any) {
      setSaveMessage({ type: 'error', text: e.message || 'Error al guardar' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) return null;

  const hasOurPrice = result?.ourPrice && result.ourPrice > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Competitividad</h1>
          <p className="text-zinc-400 mt-1">
            Compara precios en tiempo real contra la competencia vía Google Shopping.
          </p>
        </div>
        {searchesLeft !== null && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-zinc-950/50 text-sm">
            <CreditCard className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-400">{searchesLeft.toLocaleString()} créditos restantes</span>
          </div>
        )}
      </div>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl space-y-4"
      >
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">Buscar Producto</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder='ej. "iPhone 15 128GB" o "Xiaomi Redmi Note 13"'
              className="w-full bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-white/5 last:border-0 flex justify-between items-center"
                  >
                    <span className="text-sm text-white truncate pr-4">{s.title}</span>
                    <span className="text-xs font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded-md shrink-0">USD ${s.price}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            value={ourPrice}
            onChange={e => setOurPrice(e.target.value)}
            placeholder="Nuestro precio (USD)"
            className="w-full md:w-48 bg-zinc-900/60 border border-white/10 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
          />
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full md:w-36 bg-zinc-900/60 border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
          >
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.value} value={c.value} className="bg-zinc-900">{c.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* KPI Summary */}
          {hasOurPrice && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                label="Precio más bajo"
                value={result.summary.lowestCompetitor ? formatCurrency(result.summary.lowestCompetitor, result.targetCurrency) : '—'}
                sub="Competidor más barato"
                color={result.summary.lowestCompetitor && result.ourPrice! <= result.summary.lowestCompetitor ? 'emerald' : 'rose'}
                icon={TrendingDown}
              />
              <KpiCard
                label="Precio promedio"
                value={result.summary.avgCompetitor ? formatCurrency(result.summary.avgCompetitor, result.targetCurrency) : '—'}
                sub="Media de la competencia"
                color="blue"
                icon={ShieldCheck}
              />
              <KpiCard
                label="Precio más alto"
                value={result.summary.highestCompetitor ? formatCurrency(result.summary.highestCompetitor, result.targetCurrency) : '—'}
                sub="Competidor más caro"
                color="amber"
                icon={TrendingUp}
              />
              <KpiCard
                label="Posicionamiento"
                value={result.summary.competitivenessRate !== null ? `${result.summary.competitivenessRate}%` : '—'}
                sub="% competidores con precio ≥ al nuestro"
                color={result.summary.competitivenessRate !== null && result.summary.competitivenessRate >= 50 ? 'emerald' : 'rose'}
                icon={result.summary.competitivenessRate !== null && result.summary.competitivenessRate >= 50 ? CheckCircle2 : XCircle}
              />
            </div>
          )}

          {/* Banner */}
          {hasOurPrice && result.summary.avgCompetitor && (
            <PriceBanner
              ourPrice={result.ourPrice!}
              avgCompetitor={result.summary.avgCompetitor}
              lowestCompetitor={result.summary.lowestCompetitor}
              targetCurrency={result.targetCurrency}
              exchangeRate={result.exchangeRate}
              ourBasePrice={result.ourBasePrice!}
            />
          )}

          {/* Results list */}
          <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Resultados Google Shopping</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {result.competitors.length} resultados · <span className="text-zinc-300">"{result.query}"</span>
                  {result.ourPrice ? ` · Nuestro precio: ${formatCurrency(result.ourPrice, result.targetCurrency)}` : ''}
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className={cn("w-4 h-4", isSaving && "animate-pulse")} />
                {isSaving ? 'Guardando...' : 'Guardar Resultados'}
              </button>
            </div>

            {saveMessage && (
              <div className={cn(
                "mb-4 p-3 rounded-xl border text-sm flex items-center gap-2",
                saveMessage.type === 'success' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              )}>
                {saveMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {saveMessage.text}
              </div>
            )}
            <div className="space-y-3">
              {result.competitors.map((c, i) => (
                <CompetitorRow key={i} competitor={c} ourPrice={result.ourPrice} rank={i + 1} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="p-16 rounded-3xl border border-white/10 bg-zinc-950/50 text-center">
          <ShieldCheck className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
          <h3 className="text-white font-semibold text-lg mb-2">Busca un producto para comparar</h3>
          <p className="text-zinc-500 text-sm max-w-sm mx-auto">
            Ingresa el nombre del producto y opcionalmente tu precio para ver cómo te posicionas frente a la competencia en Google Shopping.
          </p>
        </div>
      )}

      {/* Top 20 Section */}
      <div className="pt-8 border-t border-white/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Top 20 Productos Más Vendidos</h2>
            <p className="text-sm text-zinc-400 mt-0.5">Basado en ventas de los últimos 30 días, comparado con el precio promedio de mercado guardado.</p>
          </div>
        </div>

        {loadingTop ? (
          <div className="flex justify-center p-12">
            <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
          </div>
        ) : topProducts.length === 0 ? (
          <div className="text-center p-8 bg-zinc-950/50 rounded-3xl border border-white/10">
            <p className="text-zinc-500 text-sm">No hay datos suficientes de los últimos 30 días.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {topProducts.map((p, i) => {
               const hasPricing = p.our_price && p.avg_competitor_price;
               const diffPct = hasPricing ? Math.round(((p.our_price! - p.avg_competitor_price!) / p.avg_competitor_price!) * 100) : null;
               const isCheaper = diffPct !== null && diffPct <= 0;
               return (
                <div key={p.id} className="p-4 rounded-2xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-md">#{i + 1}</span>
                      <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">{p.total_sold} vendidos</span>
                    </div>
                    <p className="text-sm font-medium text-white line-clamp-2 leading-snug">{p.title}</p>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Nuestro Precio:</span>
                      <span className="text-zinc-300 font-medium">{p.our_price ? formatCurrency(p.our_price, 'USD') : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Promedio Mercado:</span>
                      <span className="text-zinc-300 font-medium">{p.avg_competitor_price ? formatCurrency(p.avg_competitor_price, 'USD') : '—'}</span>
                    </div>
                    {diffPct !== null && (
                      <div className={cn("mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-xs font-medium", isCheaper ? "text-emerald-400" : "text-rose-400")}>
                        <span>Competitividad</span>
                        <span className="flex items-center gap-1">
                          {isCheaper ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {Math.abs(diffPct)}% {isCheaper ? 'más barato' : 'más caro'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriceBanner({ ourPrice, avgCompetitor, lowestCompetitor, targetCurrency, exchangeRate, ourBasePrice }: {
  ourPrice: number; avgCompetitor: number; lowestCompetitor: number | null;
  targetCurrency?: string; exchangeRate?: number; ourBasePrice?: number;
}) {
  const vsAvgPct = Math.round(((ourPrice - avgCompetitor) / avgCompetitor) * 100);
  const cheaper  = ourPrice < avgCompetitor;
  const vsLowest = lowestCompetitor !== null ? ourPrice <= lowestCompetitor : null;

  return (
    <div className={cn(
      'p-5 rounded-2xl border flex items-center gap-4',
      cheaper ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'
    )}>
      <div className={cn('p-2.5 rounded-xl', cheaper ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
        {cheaper
          ? <TrendingDown className="w-5 h-5 text-emerald-400" />
          : <TrendingUp   className="w-5 h-5 text-rose-400"    />}
      </div>
      <div>
        <p className={cn('font-semibold', cheaper ? 'text-emerald-400' : 'text-rose-400')}>
          {cheaper
            ? `Eres ${Math.abs(vsAvgPct)}% más barato que el promedio`
            : `Eres ${Math.abs(vsAvgPct)}% más caro que el promedio`}
        </p>
        <div className="flex flex-col gap-0.5 mt-0.5">
          <p className="text-xs text-zinc-500">
            Precio promedio competencia: {formatCurrency(avgCompetitor, targetCurrency || 'USD')}
            {vsLowest !== null && (vsLowest
              ? ' · Eres el más barato del mercado 🎯'
              : ` · El más barato es ${formatCurrency(lowestCompetitor!, targetCurrency || 'USD')}`)}
          </p>
          {targetCurrency && targetCurrency !== 'USD' && (
            <p className="text-[10px] text-zinc-600 flex items-center gap-1">
              Conversión activa: USD ${ourBasePrice} × {exchangeRate} = {formatCurrency(ourPrice, targetCurrency)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CompetitorRow({ competitor: c, ourPrice, rank }: {
  competitor: Competitor; ourPrice: number | null; rank: number;
}) {
  const hasComparison = ourPrice && ourPrice > 0 && c.extractedPrice > 0 && c.diffPct !== null;
  const isCheaper     = hasComparison && c.extractedPrice < ourPrice!;
  const isEqual       = hasComparison && c.extractedPrice === ourPrice!;

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors">
      <span className="text-zinc-600 font-mono text-xs w-5 pt-1 flex-shrink-0">{rank}</span>
      {c.thumbnail ? (
        <img src={c.thumbnail} alt={c.title} className="w-14 h-14 rounded-xl object-cover bg-zinc-800 flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium leading-snug line-clamp-2">{c.title}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="text-zinc-400 text-xs font-medium">{c.source}</span>
          {c.rating && (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Star className="w-3 h-3" />
              {c.rating} {c.reviews ? `(${c.reviews.toLocaleString()})` : ''}
            </span>
          )}
          {c.delivery && (
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <Truck className="w-3 h-3" />
              {c.delivery}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-white font-bold">{c.price}</p>
        {hasComparison && (
          <p className={cn(
            'text-xs font-medium mt-0.5',
            isCheaper ? 'text-rose-400' : isEqual ? 'text-zinc-400' : 'text-emerald-400'
          )}>
            {isCheaper
              ? `${Math.abs(c.diffPct!)}% más barato`
              : isEqual ? 'Precio igual'
              : `${Math.abs(c.diffPct!)}% más caro`}
          </p>
        )}
        {c.link && (
          <a
            href={c.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-300 mt-1 transition-colors"
          >
            Ver <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub: string;
  color: 'emerald' | 'rose' | 'blue' | 'amber'; icon: any;
}) {
  const styles: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose:    'text-rose-400    bg-rose-500/10    border-rose-500/20',
    blue:    'text-blue-400    bg-blue-500/10    border-blue-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
  };
  return (
    <div className="p-5 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden group">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-medium text-zinc-400 leading-tight">{label}</p>
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
