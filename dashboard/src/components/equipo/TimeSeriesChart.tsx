'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export interface TimeSeriesData {
  date: string;
  staff_id: string;
  full_name: string;
  events: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  selectedStaffIds: string[];
  startDate: string;
  endDate: string;
  loading: boolean;
}

const COLORS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f43f5e', // rose-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
];

export function TimeSeriesChart({ data, selectedStaffIds, startDate, endDate, loading }: TimeSeriesChartProps) {
  
  const { chartData, lines } = useMemo(() => {
    const isTotalMode = selectedStaffIds.length === 0;
    const dateMap = new Map<string, any>();
    const staffNames = new Set<string>();

    // 1. Initialize map with all dates in range to ensure full coverage
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Prevent infinite loops if dates are bad
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        let current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          dateMap.set(dateStr, { date: dateStr, Total: 0 });
          current.setDate(current.getDate() + 1);
        }
      }
    }

    // 2. Populate with actual data
    data.forEach((row) => {
      if (!dateMap.has(row.date)) {
        dateMap.set(row.date, { date: row.date, Total: 0 });
      }
      
      const dayEntry = dateMap.get(row.date);
      const name = row.full_name || 'Unknown';
      
      if (isTotalMode) {
        dayEntry.Total += parseInt(row.events as any, 10);
      } else {
        if (!dayEntry[name]) dayEntry[name] = 0;
        dayEntry[name] += parseInt(row.events as any, 10);
        staffNames.add(name);
      }
    });

    // 3. Ensure all entries have 0 for each staff if not present
    const namesArray = Array.from(staffNames);
    if (!isTotalMode) {
      dateMap.forEach((entry) => {
        namesArray.forEach((name) => {
          if (entry[name] === undefined) {
            entry[name] = 0;
          }
        });
      });
    }

    const sortedData = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      chartData: sortedData,
      lines: isTotalMode ? ['Total'] : namesArray
    };
  }, [data, selectedStaffIds, startDate, endDate]);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  };

  const isStacked = lines.length >= 4;

  return (
    <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-xl relative overflow-hidden group h-full">
      <CardHeader>
        <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-400" />
          Tendencia Operativa
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-4 h-[350px] relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        )}
        
        {chartData.length > 0 ? (
          <div className="h-full w-full pr-6 pl-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {lines.map((lineName, idx) => {
                    const color = COLORS[idx % COLORS.length];
                    return (
                      <linearGradient key={`color${idx}`} id={`color${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={color} stopOpacity={0}/>
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  fontSize={12}
                  tickFormatter={formatDate}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                  labelFormatter={(label) => {
                    const day = getDayOfWeek(label);
                    const parts = label.split('-');
                    if (parts.length === 3) {
                      return `Fecha: ${parts[2]}/${parts[1]}/${parts[0]} (${day})`;
                    }
                    return `Fecha: ${label}`;
                  }}
                  itemStyle={{ fontSize: '13px' }}
                />
                {lines.length > 1 && (
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
                    iconType="circle"
                  />
                )}
                {lines.map((lineName, idx) => (
                  <Area 
                    key={lineName}
                    type="monotone" 
                    dataKey={lineName} 
                    name={lineName}
                    stroke={COLORS[idx % COLORS.length]} 
                    fillOpacity={1}
                    fill={`url(#color${idx})`}
                    strokeWidth={2}
                    stackId={isStacked ? "1" : undefined}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    animationDuration={1000}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-slate-500 text-sm">
            {!loading && "No hay datos para esta selección."}
          </div>
        )}
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      </CardContent>
    </Card>
  );
}
