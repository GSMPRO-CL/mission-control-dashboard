'use client';

import { type LucideIcon } from 'lucide-react';
import { Skeleton } from './Skeleton';

interface MiniListProps {
  title: string;
  icon: LucideIcon;
  items: Array<{ label: string; sublabel?: string; value: string | number }>;
  loading?: boolean;
  emptyMessage?: string;
}

export function MiniList({ title, icon: Icon, items, loading, emptyMessage = "No hay datos disponibles" }: MiniListProps) {
  if (loading) {
    return (
      <div className="glass-card p-5 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 h-full flex flex-col relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      {(!items || items.length === 0) ? (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3 relative z-10 flex-1">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors duration-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500/80 to-purple-500/80 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                  {item.label.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white line-clamp-1">{item.label}</p>
                  {item.sublabel && <p className="text-xs text-zinc-400">{item.sublabel}</p>}
                </div>
              </div>
              <div className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md border border-indigo-500/20">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
    </div>
  );
}
