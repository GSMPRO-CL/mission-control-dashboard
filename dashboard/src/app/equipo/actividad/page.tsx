'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, User } from 'lucide-react';

import { DateRangeFilter, DateRange } from '@/components/equipo/DateRangeFilter';
import { StaffFilter, StaffMember } from '@/components/equipo/StaffFilter';
import { PaginatedTable, EventData } from '@/components/equipo/PaginatedTable';
import { TimeSeriesChart, TimeSeriesData } from '@/components/equipo/TimeSeriesChart';
import { ActionFilter } from '@/components/equipo/ActionFilter';

interface SummaryData {
  staff_id: string;
  full_name: string;
  action: string;
  event_count: number;
  last_activity: string;
}

interface MetaData {
  totalEvents: number;
  totalPages: number;
  currentPage: number;
  staffList: StaffMember[];
  actionList: string[];
  dateRange: { startDate: string; endDate: string };
}

export default function EquipoActividadPage() {
  // Filters State
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: firstDay.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0]
  });

  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Data State
  const [summary, setSummary] = useState<SummaryData[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [events, setEvents] = useState<EventData[]>([]);
  const [meta, setMeta] = useState<MetaData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: `${dateRange.startDate}T00:00:00Z`,
        endDate: `${dateRange.endDate}T23:59:59Z`,
        page: page.toString(),
        limit: limit.toString(),
      });

      if (selectedStaffIds.length > 0) {
        params.append('staffIds', selectedStaffIds.join(','));
      }
      if (selectedActions.length > 0) {
        params.append('actions', selectedActions.join(','));
      }

      const res = await fetch(`/api/equipo/actividad?${params.toString()}`);
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSummary(data.summary || []);
      setTimeSeries(data.timeSeries || []);
      setEvents(data.recentEvents || []);
      setMeta(data.meta || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when any filter changes
  useEffect(() => {
    fetchData();
  }, [dateRange, selectedStaffIds, selectedActions, page, limit]);

  // When filters change that affect the total dataset (date, staff, actions), reset to page 1
  useEffect(() => {
    setPage(1);
  }, [dateRange, selectedStaffIds, selectedActions, limit]);

  // Transform summary for BarChart (Group by staff)
  const chartDataMap = summary.reduce((acc, curr) => {
    const name = curr.full_name || 'Unknown';
    if (!acc[name]) {
      acc[name] = { name, total: 0 };
    }
    acc[name].total += parseInt(curr.event_count as any, 10);
    return acc;
  }, {} as Record<string, { name: string, total: number }>);

  const barChartData = Object.values(chartDataMap).sort((a, b) => b.total - a.total);
  const filteredTotalEvents = meta?.totalEvents || 0;

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="bg-red-500/10 text-red-400 p-4 rounded-xl border border-red-500/20">
          ❌ Error cargando actividad: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-slate-100">

      {/* Header & Main Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 to-emerald-500 bg-clip-text text-transparent">
            Actividad del Equipo
          </h1>
          <p className="text-slate-400 mt-2">Monitoreo y atribución de acciones en Shopify</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          {meta?.staffList && (
            <StaffFilter staffList={meta.staffList} onChange={setSelectedStaffIds} />
          )}
          {meta?.actionList && (
            <ActionFilter actionList={meta.actionList} onChange={setSelectedActions} />
          )}
          <div className="bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-lg">{filteredTotalEvents}</span>
            <span className="text-slate-400 text-sm">Eventos</span>
          </div>
        </div>
      </div>

      {/* Date Filter */}
      <DateRangeFilter
        initialStartDate={dateRange.startDate}
        initialEndDate={dateRange.endDate}
        onChange={setDateRange}
      />

      {/* Primary Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <Card className="col-span-2 bg-slate-900/60 border-slate-800 backdrop-blur-xl relative">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Operaciones Totales por Empleado</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !barChartData.length ? (
              <Skeleton className="w-full h-[350px]" />
            ) : (
              <div className="h-[350px] w-full overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 relative z-10">
                <div style={{ width: '100%', height: Math.max(barChartData.length * 45, 350) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} layout="vertical" margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        width={140}
                        tick={{ fill: '#94a3b8' }}
                      />
                      <Tooltip
                        cursor={{ fill: '#1e293b' }}
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                      />
                      <Bar dataKey="total" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Actions */}
        <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl relative">
          <CardHeader>
            <CardTitle className="text-lg text-slate-200">Top Acciones</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && !summary.length ? (
              <Skeleton className="w-full h-[300px]" />
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
                {summary.slice(0, 10).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 transition border border-slate-700/30">
                    <div className="flex flex-col overflow-hidden pr-2">
                      <span className="font-medium text-emerald-400 text-sm truncate">{item.action}</span>
                      <span className="text-xs text-slate-400 truncate">{item.full_name || 'Unknown'}</span>
                    </div>
                    <span className="bg-slate-700/50 text-slate-200 px-3 py-1 rounded-full text-xs font-semibold shrink-0">
                      {item.event_count}
                    </span>
                  </div>
                ))}
                {summary.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">No hay datos</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time Series Chart */}
      <div className="w-full">
        <TimeSeriesChart
          data={timeSeries}
          selectedStaffIds={selectedStaffIds}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          loading={loading && timeSeries.length === 0}
        />
      </div>

      {/* Paginated Data Table */}
      <div className="w-full pt-4">
        <PaginatedTable
          events={events}
          currentPage={meta?.currentPage || 1}
          totalPages={meta?.totalPages || 1}
          totalEvents={meta?.totalEvents || 0}
          limit={limit}
          loading={loading}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </div>

    </div>
  );
}
