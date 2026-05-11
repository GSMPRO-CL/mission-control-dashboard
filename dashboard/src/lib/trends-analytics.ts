export interface TimelinePoint {
  date: string;
  timestamp: string;
  values: Array<{ query: string; value: string; extracted_value: number }>;
}

export interface AveragePoint {
  query: string;
  value: number;
}

export interface MomentumResult {
  percentage: number;
  direction: 'rising' | 'declining' | 'neutral';
}

export interface PeakInfo {
  value: number;
  date: string;
}

// Compare avg of last 4 data points vs previous 4 data points
export function calculateMomentum(timeline: TimelinePoint[], query: string): MomentumResult {
  const vals = timeline
    .map(pt => pt.values.find(v => v.query === query)?.extracted_value)
    .filter((v): v is number => v !== undefined);

  if (vals.length < 8) return { percentage: 0, direction: 'neutral' };

  const last8      = vals.slice(-8);
  const recentAvg  = (last8[4] + last8[5] + last8[6] + last8[7]) / 4;
  const previousAvg = (last8[0] + last8[1] + last8[2] + last8[3]) / 4;

  if (previousAvg === 0) return { percentage: 0, direction: 'neutral' };

  const pct     = ((recentAvg - previousAvg) / previousAvg) * 100;
  const rounded = Math.round(pct * 10) / 10;

  return {
    percentage: rounded,
    direction:  pct > 5 ? 'rising' : pct < -5 ? 'declining' : 'neutral',
  };
}

// Term with the highest overall average interest (requires 2+ terms)
export function findWinner(averages: AveragePoint[]): string | null {
  if (averages.length < 2) return null;
  return averages.reduce((best, curr) => curr.value > best.value ? curr : best).query;
}

// Returns month numbers (01–12) with recurring above-average peaks across multiple years
export function detectSeasonalMonths(timeline: TimelinePoint[], query: string): Set<string> {
  const byMonth: Record<string, { sum: number; count: number; years: Set<number> }> = {};

  for (const pt of timeline) {
    const val = pt.values.find(v => v.query === query)?.extracted_value;
    if (val === undefined) continue;
    const ts = parseInt(pt.timestamp, 10) * 1000;
    if (isNaN(ts)) continue;
    const d     = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    if (!byMonth[month]) byMonth[month] = { sum: 0, count: 0, years: new Set() };
    byMonth[month].sum += val;
    byMonth[month].count++;
    byMonth[month].years.add(d.getFullYear());
  }

  const qualified = Object.entries(byMonth)
    .filter(([, v]) => v.years.size >= 2)
    .map(([month, v]) => ({ month, avg: v.sum / v.count }));

  if (!qualified.length) return new Set();

  const sorted    = [...qualified].sort((a, b) => a.avg - b.avg);
  const threshold = sorted[Math.floor(sorted.length * 0.7)]?.avg ?? 0;

  return new Set(qualified.filter(m => m.avg >= threshold).map(m => m.month));
}

// Highest interest value and its date for a given query
export function getPeakInfo(timeline: TimelinePoint[], query: string): PeakInfo {
  let maxVal  = 0;
  let peakDate = '';
  for (const pt of timeline) {
    const val = pt.values.find(v => v.query === query)?.extracted_value ?? 0;
    if (val > maxVal) { maxVal = val; peakDate = formatDateLabel(pt.date); }
  }
  return { value: maxVal, date: peakDate };
}

// Transform SerpAPI timeline into Recharts rows.
// When seasonalMonths is provided, adds `_seasonalBg` (0 or 100) for chart background highlighting.
export function buildChartData(
  timeline: TimelinePoint[],
  queries: string[],
  seasonalMonths?: Set<string>,
): Array<Record<string, string | number>> {
  return timeline.map(pt => {
    const row: Record<string, string | number> = { date: formatDateLabel(pt.date) };

    if (seasonalMonths) {
      const ts    = parseInt(pt.timestamp, 10) * 1000;
      const month = isNaN(ts) ? '' : String(new Date(ts).getMonth() + 1).padStart(2, '0');
      row._seasonalBg = seasonalMonths.has(month) ? 100 : 0;
    }

    for (const q of queries) {
      const match = pt.values.find(v => v.query === q);
      row[q] = match?.extracted_value ?? 0;
    }
    return row;
  });
}

export function formatDateLabel(raw: string): string {
  // "Dec 29 – Jan 4, 2020"  → "Dec 29"
  // "Jan 2020"              → "Jan 2020"
  return raw.split('–')[0].split(',')[0].trim();
}

// Trigger a CSV download in the browser
export function exportCSV(timeline: TimelinePoint[], queries: string[]): void {
  const header = ['Date', ...queries].join(',');
  const rows   = timeline.map(pt => {
    const vals = queries.map(q => String(pt.values.find(v => v.query === q)?.extracted_value ?? 0));
    return [`"${pt.date}"`, ...vals].join(',');
  });
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `trends_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
