'use client';

import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';

interface MiniAreaChartProps {
  data: any[];
  dataKeys: { key: string; name: string; color: string }[];
  xAxisKey: string;
  title: string;
  subtitle?: string;
  loading?: boolean;
  yAxisFormatter?: (value: number) => string;
}

export function MiniAreaChart({ data, dataKeys, xAxisKey, title, subtitle, loading, yAxisFormatter }: MiniAreaChartProps) {
  if (loading) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="mb-4">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="w-full flex-1 min-h-[150px]" />
      </div>
    );
  }

  const defaultFormatter = (val: number) => new Intl.NumberFormat('en-US').format(val);
  const formatter = yAxisFormatter || defaultFormatter;

  return (
    <div className="glass-card p-5 h-full flex flex-col">
      <div className="mb-4 relative z-10">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>

      {(!data || data.length === 0) ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm min-h-[150px]">
          No hay datos para este periodo
        </div>
      ) : (
        <div className="flex-1 min-h-[150px] w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {dataKeys.map((dk, idx) => (
                  <linearGradient key={`color${idx}`} id={`color${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={dk.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={dk.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis 
                dataKey={xAxisKey} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={(val) => {
                  const date = new Date(val);
                  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                }}
                minTickGap={20}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#71717a', fontSize: 10 }}
                tickFormatter={formatter}
                width={60}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
                labelFormatter={(label) => new Date(label).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                formatter={(value: any, name: any) => {
                  const dkName = dataKeys.find(k => k.key === name)?.name || name;
                  return [formatter(value as number), dkName as string];
                }}
              />
              {dataKeys.map((dk, idx) => (
                <Area 
                  key={idx}
                  type="monotone" 
                  dataKey={dk.key} 
                  stroke={dk.color} 
                  fillOpacity={1} 
                  fill={`url(#color${dk.key})`} 
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
