"use client";

import { useState, useEffect } from 'react';
import {
  Search, RefreshCw, Plus, X, Save, Download,
  AlertCircle, Activity, Clock, Trophy, MapPin,
  Trash2, ChevronDown, Sparkles,
} from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  calculateMomentum,
  findWinner,
  detectSeasonalMonths,
  getPeakInfo,
  buildChartData,
  exportCSV,
  formatDateLabel,
  type TimelinePoint,
  type AveragePoint,
} from '@/lib/trends-analytics';

// ─── Constants ───────────────────────────────────────────────────────────────

const LINE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1',
];

const OVERLAY_COLORS = [
  '#fb923c', '#22d3ee', '#a3e635', '#f472b6', '#818cf8',
  '#4ade80', '#facc15', '#38bdf8', '#e879f9', '#34d399',
];

const DATE_OPTIONS = [
  { label: 'Fast 12 months', value: 'today 12-m' },
  { label: 'Last month',     value: 'today 1-m'  },
  { label: 'Last 3 months',  value: 'today 3-m'  },
  { label: 'Last 5 years',   value: 'today 5-y'  },
];

const GEO_OPTIONS = [
  { label: 'Worldwide',      value: ''   },
  { label: 'United States',  value: 'US' },
  { label: 'Chile',          value: 'CL' },
  { label: 'Argentina',      value: 'AR' },
  { label: 'Colombia',       value: 'CO' },
  { label: 'Mexico',         value: 'MX' },
  { label: 'Spain',          value: 'ES' },
  { label: 'United Kingdom', value: 'GB' },
];

const GPROP_OPTIONS = [
  { label: 'Web Search', value: ''        },
  { label: 'Images',     value: 'images'  },
  { label: 'News',       value: 'news'    },
  { label: 'YouTube',    value: 'youtube' },
  { label: 'Shopping',   value: 'froogle' },
];

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const LS_KEY = 'serpapi_saved_searches';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RateLimit {
  searchesLeft: number | null;
  monthlyUsage: number | null;
  monthlyLimit: number | null;
  planName:     string;
}

interface TrendsData {
  timeline:  TimelinePoint[];
  averages:  AveragePoint[];
  queries:   string[];
  topRegion: string;
  fetchedAt: string;
  rateLimit: RateLimit;
}

interface SavedSearch {
  id:        string;
  savedAt:   string;
  queries:   string[];
  dateRange: string;
  geo:       string;
  gprop:     string;
  timeline:  TimelinePoint[];
  averages:  AveragePoint[];
  topRegion: string;
}

interface OverlayEntry {
  id:          string;
  queries:     string[];
  timeline:    TimelinePoint[];
  savedAt:     string;
  colorOffset: number;
}

interface RelatedQuery { query: string; value: string }
interface RelatedQueriesForTerm { top: RelatedQuery[]; rising: RelatedQuery[] }
type RelatedQueriesMap = Record<string, RelatedQueriesForTerm>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildChartDataWithOverlays(
  timeline: TimelinePoint[],
  queries: string[],
  seasonalMonths: Set<string> | undefined,
  overlays: OverlayEntry[],
): Array<Record<string, string | number>> {
  const rows = buildChartData(timeline, queries, seasonalMonths);
  if (!overlays.length) return rows;

  const byDate = new Map<string, Record<string, string | number>>();
  for (const row of rows) byDate.set(String(row.date), row);

  for (const overlay of overlays) {
    const datePrefix = overlay.savedAt.slice(0, 10);
    for (const pt of overlay.timeline) {
      const label = formatDateLabel(pt.date);
      const row   = byDate.get(label);
      if (!row) continue;
      for (const q of overlay.queries) {
        const match = pt.values.find(v => v.query === q);
        row[`${q} (${datePrefix})`] = match?.extracted_value ?? 0;
      }
    }
  }

  return rows;
}

function totalOverlayLines(overlays: OverlayEntry[]): number {
  return overlays.reduce((acc, o) => acc + o.queries.length, 0);
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TrendsDashboard() {
  const [primaryTerm,    setPrimaryTerm]    = useState('');
  const [compareTerms,   setCompareTerms]   = useState<string[]>([]);
  const [dateRange,      setDateRange]      = useState('today 12-m');
  const [geo,            setGeo]            = useState('');
  const [gprop,          setGprop]          = useState('');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [data,           setData]           = useState<TrendsData | null>(null);
  const [activeQueries,  setActiveQueries]  = useState<string[]>([]);
  const [rateLimit,      setRateLimit]      = useState<RateLimit | null>(null);
  const [savedSearches,  setSavedSearches]  = useState<SavedSearch[]>([]);
  const [overlays,       setOverlays]       = useState<OverlayEntry[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedData,    setRelatedData]    = useState<RelatedQueriesMap | null>(null);
  const [relatedError,   setRelatedError]   = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSavedSearches(JSON.parse(raw));
    } catch {}
  }, []);

  const persistSaved = (list: SavedSearch[]) => {
    setSavedSearches(list);
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
  };

  const doSearch = async (q: string, date: string, geoParam: string, gpropParam: string) => {
    setLoading(true);
    setError(null);
    setRelatedData(null);
    setRelatedError(null);
    try {
      const params = new URLSearchParams({ q, date });
      if (geoParam)   params.set('geo',   geoParam);
      if (gpropParam) params.set('gprop', gpropParam);
      const res  = await fetch(`/api/trends?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
      setActiveQueries(json.data.queries);
      setRateLimit(json.data.rateLimit);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    const terms = [primaryTerm.trim(), ...compareTerms.map(t => t.trim())].filter(Boolean);
    if (!terms.length) return;
    doSearch(terms.join(','), dateRange, geo, gprop);
  };

  const removeQuery = (q: string) => {
    const remaining = activeQueries.filter(aq => aq !== q);
    if (!remaining.length) {
      setData(null);
      setActiveQueries([]);
      setPrimaryTerm('');
      setCompareTerms([]);
      setRelatedData(null);
      return;
    }
    const [first, ...rest] = remaining;
    setPrimaryTerm(first);
    setCompareTerms(rest);
    doSearch(remaining.join(','), dateRange, geo, gprop);
  };

  const handleSave = () => {
    if (!data) return;
    const entry: SavedSearch = {
      id:        Date.now().toString(),
      savedAt:   new Date().toISOString(),
      queries:   data.queries,
      dateRange,
      geo,
      gprop,
      timeline:  data.timeline,
      averages:  data.averages,
      topRegion: data.topRegion,
    };
    persistSaved([entry, ...savedSearches]);
  };

  const loadOverlay = (s: SavedSearch, colorOffset: number) => {
    setOverlays(prev => [...prev, {
      id: s.id, queries: s.queries, timeline: s.timeline,
      savedAt: s.savedAt, colorOffset,
    }]);
  };

  const unloadOverlay = (id: string) => setOverlays(prev => prev.filter(o => o.id !== id));

  const removeSaved = (id: string) => {
    persistSaved(savedSearches.filter(s => s.id !== id));
    setOverlays(prev => prev.filter(o => o.id !== id));
  };

  const loadRelated = async () => {
    if (!data) return;
    setRelatedLoading(true);
    setRelatedError(null);
    try {
      const q   = data.queries.join(',');
      const res = await fetch(`/api/trends/related?q=${encodeURIComponent(q)}&date=${encodeURIComponent(dateRange)}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRelatedData(json.data.relatedQueries);
    } catch (e: any) {
      setRelatedError(e.message);
    } finally {
      setRelatedLoading(false);
    }
  };

  // Derived
  const firstQuery     = data?.queries[0];
  const seasonalMonths = firstQuery ? detectSeasonalMonths(data!.timeline, firstQuery) : new Set<string>();
  const showSeasonal   = dateRange !== 'today 1-m' && dateRange !== 'today 3-m';
  const chartData      = data
    ? buildChartDataWithOverlays(data.timeline, data.queries, showSeasonal ? seasonalMonths : undefined, overlays)
    : [];
  const winner         = data ? findWinner(data.averages) : null;
  const bestPerforming = winner ?? data?.queries[0] ?? '—';
  const bestAvg        = Math.round(data?.averages.find(a => a.query === bestPerforming)?.value ?? 0);
  const bestPeak       = data ? getPeakInfo(data.timeline, bestPerforming).value : 0;
  const fetchedDate    = data?.fetchedAt ? new Date(data.fetchedAt) : null;
  const showPanels     = loading || !!data;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">SerpApi Trends</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Compare search terms in real time with Google Trends via SerpApi.
          </p>
        </div>
        {rateLimit !== null && rateLimit.searchesLeft !== null && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-950/50 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-xs text-zinc-400">
              API: <span className="text-white font-semibold">{rateLimit.searchesLeft}</span> searches left
            </span>
          </div>
        )}
      </div>

      {/* ── 2-column layout ── */}
      <div className="flex gap-5 items-start">

        {/* ── Main content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Search card ── */}
          <div className="p-4 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl space-y-3">
            {/* Primary term row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={primaryTerm}
                  onChange={e => setPrimaryTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search term…"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <button
                onClick={() => setCompareTerms(prev => [...prev, ''])}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl text-sm transition-all shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Compare
              </button>
              <button
                onClick={handleSearch}
                disabled={loading || !primaryTerm.trim()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Compare term rows */}
            {compareTerms.map((term, i) => (
              <div key={i} className="flex gap-2">
                <div className="relative flex-1">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none"
                    style={{ backgroundColor: LINE_COLORS[(i + 1) % LINE_COLORS.length] }}
                  />
                  <input
                    type="text"
                    value={term}
                    onChange={e => {
                      const updated = [...compareTerms];
                      updated[i] = e.target.value;
                      setCompareTerms(updated);
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder={`Compare term ${i + 2}…`}
                    className="w-full pl-8 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-zinc-600 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  />
                </div>
                <button
                  onClick={() => setCompareTerms(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-2.5 border border-white/10 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 text-zinc-500 hover:text-rose-400 rounded-xl transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Filter row */}
            <div className="flex gap-2 flex-wrap">
              <select
                value={geo}
                onChange={e => setGeo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
              >
                {GEO_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                ))}
              </select>
              <select
                value={dateRange}
                onChange={e => setDateRange(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
              >
                {DATE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                ))}
              </select>
              <select
                value={gprop}
                onChange={e => setGprop(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl text-white text-xs px-3 py-2 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer"
              >
                {GPROP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                ))}
              </select>
            </div>

            {/* Active query chips */}
            {activeQueries.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-0.5">
                {activeQueries.map((q, i) => (
                  <span
                    key={q}
                    className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border text-xs font-medium"
                    style={{
                      backgroundColor: LINE_COLORS[i % LINE_COLORS.length] + '18',
                      borderColor:     LINE_COLORS[i % LINE_COLORS.length] + '55',
                      color:           LINE_COLORS[i % LINE_COLORS.length],
                    }}
                  >
                    {q}
                    <button
                      onClick={() => removeQuery(q)}
                      disabled={loading}
                      className="hover:opacity-70 transition-opacity disabled:opacity-30 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <p className="text-rose-300 text-sm">{error}</p>
            </div>
          )}

          {showPanels && (
            <>
              {/* ── Action buttons ── */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleSave}
                  disabled={!data || loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  onClick={() => data && exportCSV(data.timeline, data.queries)}
                  disabled={!data || loading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>

              {/* ── 4-card stats ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {loading ? (
                  <>
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                    <Skeleton className="h-20 rounded-2xl" />
                  </>
                ) : data && (
                  <>
                    <div className="p-4 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Search className="w-3.5 h-3.5 text-zinc-500" />
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Terms</p>
                      </div>
                      <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
                        {data.queries.join(', ')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Best Performing</p>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{bestPerforming}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">avg {bestAvg} · peak {bestPeak}</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Top Region</p>
                      </div>
                      <p className="text-sm font-semibold text-white">{data.topRegion}</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Updated</p>
                      </div>
                      {fetchedDate ? (
                        <>
                          <p className="text-sm font-semibold text-white tabular-nums">
                            {fetchedDate.toLocaleTimeString('en-US', { hour12: false })}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
                            {fetchedDate.toLocaleDateString('en-GB')}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-zinc-600">—</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Chart ── */}
          {showPanels && (
            <div className="p-6 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-5 w-48 rounded-lg" />
                  <Skeleton className="h-[320px] w-full rounded-2xl" />
                </div>
              ) : data && (
                <>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-base font-bold text-white">Interest Over Time</h2>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Click a legend item to toggle it</p>
                    </div>
                    {overlays.length > 0 && (
                      <span className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
                        <span className="inline-block w-5 border-t-2 border-dashed border-zinc-500" />
                        {totalOverlayLines(overlays)} overlay{totalOverlayLines(overlays) !== 1 ? 's' : ''} · dashed lines
                      </span>
                    )}
                  </div>

                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                        barCategoryGap="0%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis
                          dataKey="date"
                          stroke="#52525b"
                          fontSize={10}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          stroke="#52525b"
                          fontSize={10}
                          tickLine={false}
                          domain={[0, 100]}
                        />
                        <RechartsTooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const isSeasonal = payload.some(
                              p => p.dataKey === '_seasonalBg' && Number(p.value) === 100,
                            );
                            const filtered = payload.filter(p => p.dataKey !== '_seasonalBg');
                            if (!filtered.length) return null;
                            return (
                              <div className="bg-zinc-950 border border-zinc-800 rounded-2xl px-3.5 py-3 text-xs min-w-[160px]">
                                <p className="text-zinc-400 font-medium mb-2">{label}</p>
                                {filtered.map(p => (
                                  <div key={String(p.dataKey)} className="flex items-center gap-2 mb-1.5 last:mb-0">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                    <span className="text-zinc-300 flex-1 truncate max-w-[160px]">{String(p.dataKey)}</span>
                                    <span className="text-white font-semibold tabular-nums">{p.value}</span>
                                  </div>
                                ))}
                                {isSeasonal && (
                                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800">
                                    <span className="w-2 h-2 rounded-sm bg-violet-500/60 shrink-0" />
                                    <span className="text-violet-400">Seasonal peak</span>
                                  </div>
                                )}
                              </div>
                            );
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', color: '#a1a1aa', paddingTop: '12px' }} />

                        {showSeasonal && seasonalMonths.size > 0 && (
                          <Bar
                            dataKey="_seasonalBg"
                            fill="rgba(139,92,246,0.08)"
                            isAnimationActive={false}
                            legendType="none"
                            name=""
                          />
                        )}

                        {data.queries.map((q, i) => (
                          <Line
                            key={q}
                            type="monotone"
                            dataKey={q}
                            stroke={LINE_COLORS[i % LINE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))}

                        {overlays.map(overlay =>
                          overlay.queries.map((q, qi) => {
                            const key   = `${q} (${overlay.savedAt.slice(0, 10)})`;
                            const color = OVERLAY_COLORS[(overlay.colorOffset + qi) % OVERLAY_COLORS.length];
                            return (
                              <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={color}
                                strokeWidth={1.5}
                                strokeDasharray="5 3"
                                dot={false}
                                activeDot={{ r: 3 }}
                              />
                            );
                          })
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </div>
          )}

          {/* ── Comparison Table ── */}
          {showPanels && (
            loading
              ? <ComparisonTableSkeleton rows={activeQueries.length || 2} />
              : data && <ComparisonTable data={data} />
          )}

          {/* ── Related Queries ── */}
          {data && !loading && (
            <div className="space-y-3">
              {!relatedData ? (
                <>
                  <button
                    onClick={loadRelated}
                    disabled={relatedLoading}
                    className="flex items-center gap-2 w-full justify-center py-3.5 rounded-3xl border border-dashed border-white/10 hover:border-white/20 text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-all disabled:opacity-50"
                  >
                    {relatedLoading
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    {relatedLoading
                      ? 'Loading related queries…'
                      : `Load related queries (–${data.queries.length} credit${data.queries.length > 1 ? 's' : ''})`}
                  </button>
                  {relatedError && (
                    <p className="text-xs text-rose-400 text-center">{relatedError}</p>
                  )}
                </>
              ) : (
                <RelatedQueriesSection relatedData={relatedData} queries={data.queries} />
              )}
            </div>
          )}

          {/* ── Empty state ── */}
          {!loading && !data && !error && (
            <div className="p-16 rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl text-center">
              <Activity className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
              <h3 className="text-white font-semibold text-lg mb-2">Enter a term to get started</h3>
              <p className="text-zinc-500 text-sm">Type a search term and click Search.</p>
            </div>
          )}
        </div>

        {/* ── Saved Searches Sidebar ── */}
        <SavedSearchesSidebar
          savedSearches={savedSearches}
          overlays={overlays}
          onLoad={loadOverlay}
          onUnload={unloadOverlay}
          onRemove={removeSaved}
          onExport={s => exportCSV(s.timeline, s.queries)}
        />
      </div>
    </div>
  );
}

// ─── SavedSearchesSidebar ─────────────────────────────────────────────────────

function SavedSearchesSidebar({
  savedSearches, overlays, onLoad, onUnload, onRemove, onExport,
}: {
  savedSearches: SavedSearch[];
  overlays:      OverlayEntry[];
  onLoad:        (s: SavedSearch, colorOffset: number) => void;
  onUnload:      (id: string) => void;
  onRemove:      (id: string) => void;
  onExport:      (s: SavedSearch) => void;
}) {
  return (
    <div className="w-72 shrink-0">
      <div className="sticky top-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Saved Searches</h2>
          {savedSearches.length > 0 && (
            <span className="text-xs bg-white/10 text-zinc-300 px-2 py-0.5 rounded-full font-medium">
              {savedSearches.length} saved
            </span>
          )}
        </div>

        {savedSearches.length === 0 ? (
          <div className="p-5 rounded-2xl border border-dashed border-white/10 text-center">
            <p className="text-xs text-zinc-600">No saved searches yet.</p>
            <p className="text-[10px] text-zinc-700 mt-1">
              Run a search then click Save to store it here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedSearches.map((s, idx) => {
              const isLoaded       = overlays.some(o => o.id === s.id);
              const dateObj        = new Date(s.savedAt);
              const dateLabel      = dateObj.toLocaleDateString('en-CA');
              const geoLabel       = GEO_OPTIONS.find(g => g.value === s.geo)?.label      ?? 'Worldwide';
              const gpropLabel     = GPROP_OPTIONS.find(g => g.value === s.gprop)?.label  ?? 'Web Search';
              const dateRangeLabel = DATE_OPTIONS.find(d => d.value === s.dateRange)?.label ?? s.dateRange;

              return (
                <div
                  key={s.id}
                  className={cn(
                    'p-3 rounded-2xl border bg-zinc-950/50 backdrop-blur-xl space-y-2.5 transition-colors',
                    isLoaded ? 'border-blue-500/30' : 'border-white/10',
                  )}
                >
                  <p className="text-xs font-semibold text-zinc-200 truncate">
                    {dateLabel} {s.queries.join(', ')}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {dateLabel} · {s.queries.length} term{s.queries.length > 1 ? 's' : ''}
                  </p>

                  {/* Filter chips */}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-zinc-500">
                      {geoLabel}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-zinc-500">
                      {dateRangeLabel}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-zinc-500">
                      {gpropLabel}
                    </span>
                  </div>

                  {/* Query chips */}
                  <div className="flex flex-wrap gap-1">
                    {s.queries.map((q, qi) => (
                      <span
                        key={q}
                        className="text-[10px] px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: LINE_COLORS[qi % LINE_COLORS.length] + '18',
                          borderColor:     LINE_COLORS[qi % LINE_COLORS.length] + '55',
                          color:           LINE_COLORS[qi % LINE_COLORS.length],
                        }}
                      >
                        {q}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={() => isLoaded ? onUnload(s.id) : onLoad(s, idx)}
                      className={cn(
                        'flex-1 text-[10px] py-1.5 rounded-lg border font-medium transition-all',
                        isLoaded
                          ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                          : 'border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {isLoaded ? 'Unload' : 'Load'}
                    </button>
                    <button
                      onClick={() => onRemove(s.id)}
                      title="Remove"
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onExport(s)}
                      title="Export CSV"
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10 transition-all"
                    >
                      <Download className="w-3 h-3" />
                    </button>
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

// ─── ComparisonTable ──────────────────────────────────────────────────────────

function ComparisonTableSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/50 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <Skeleton className="h-4 w-40 rounded" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 border-b border-white/5 last:border-0 flex gap-6">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3.5 w-10 rounded ml-auto" />
          <Skeleton className="h-3.5 w-10 rounded" />
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-14 rounded" />
          <Skeleton className="h-3.5 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

function ComparisonTable({ data }: { data: TrendsData }) {
  const rows = data.queries.map((q, i) => {
    const avg      = Math.round(data.averages.find(a => a.query === q)?.value ?? 0);
    const peak     = getPeakInfo(data.timeline, q);
    const momentum = calculateMomentum(data.timeline, q);
    const seasonal = detectSeasonalMonths(data.timeline, q);
    const months   = Array.from(seasonal).sort()
      .map(m => MONTH_NAMES[parseInt(m, 10) - 1]).join(', ') || '—';
    return { query: q, avg, peak, momentum, months, color: LINE_COLORS[i % LINE_COLORS.length] };
  });

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <h2 className="text-sm font-bold text-white">Detailed Comparison</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left  text-xs text-zinc-500 font-medium px-5 py-3">Term</th>
              <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Average</th>
              <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Peak</th>
              <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Peak Date</th>
              <th className="text-right text-xs text-zinc-500 font-medium px-4 py-3">Momentum</th>
              <th className="text-left  text-xs text-zinc-500 font-medium px-4 py-3">Seasonality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const dir   = row.momentum.direction;
              const mText =
                dir === 'rising'    ? 'text-emerald-400' :
                dir === 'declining' ? 'text-rose-400'    :
                'text-zinc-400';
              return (
                <tr key={row.query} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-white font-medium">{row.query}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3.5 text-zinc-300 tabular-nums">{row.avg}/100</td>
                  <td className="text-right px-4 py-3.5 text-zinc-300 tabular-nums font-semibold">{row.peak.value}/100</td>
                  <td className="text-right px-4 py-3.5 text-zinc-500 text-xs tabular-nums">{row.peak.date || '—'}</td>
                  <td className="text-right px-4 py-3.5">
                    <span className={cn('tabular-nums text-xs', mText)}>
                      {row.momentum.percentage > 0 ? '+' : ''}{row.momentum.percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-zinc-400 text-xs">{row.months}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── RelatedQueriesSection ────────────────────────────────────────────────────

function RelatedQueriesSection({
  relatedData, queries,
}: { relatedData: RelatedQueriesMap; queries: string[] }) {
  const [expanded, setExpanded] = useState<string | null>(queries[0] ?? null);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-white">Related Queries</h2>
      {queries.map((q, qi) => {
        const related = relatedData[q];
        if (!related) return null;
        const isOpen = expanded === q;
        const color  = LINE_COLORS[qi % LINE_COLORS.length];

        return (
          <div key={q} className="rounded-3xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : q)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-semibold text-white">{q}</span>
                <span className="text-xs text-zinc-500">
                  {(related.top?.length ?? 0)} top · {(related.rising?.length ?? 0)} rising
                </span>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-zinc-500 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {isOpen && (
              <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-5">
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Top</p>
                  <div className="space-y-2">
                    {(related.top || []).slice(0, 10).map(rq => {
                      const pct = Math.min(100, parseInt(rq.value, 10) || 0);
                      return (
                        <div key={rq.query} className="flex items-center gap-3">
                          <div className="flex-1 relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: color + '80' }}
                            />
                          </div>
                          <span className="text-xs text-zinc-300 min-w-0 flex-shrink truncate max-w-[200px] text-right">
                            {rq.query}
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums w-7 text-right shrink-0">{pct}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Rising</p>
                  <div className="flex flex-wrap gap-2">
                    {(related.rising || []).slice(0, 12).map(rq => {
                      const isBreakout = rq.value === 'Breakout';
                      return (
                        <div
                          key={rq.query}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs',
                            isBreakout
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
                          )}
                        >
                          <span className="truncate max-w-[140px]">{rq.query}</span>
                          <span className={cn('font-semibold shrink-0', isBreakout ? 'text-amber-400' : 'text-emerald-400')}>
                            {isBreakout ? '🔥' : rq.value}
                          </span>
                        </div>
                      );
                    })}
                    {(!related.rising || related.rising.length === 0) && (
                      <p className="text-xs text-zinc-600">No rising data available</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
