import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'violet' | 'zinc' | 'cyan' | 'orange';
  loading?: boolean;
  subtitle?: string;
}

const colorStyles = {
  blue: 'from-blue-500/20 to-blue-500/5 text-blue-400 border-blue-500/20',
  emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/20',
  amber: 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/20',
  purple: 'from-purple-500/20 to-purple-500/5 text-purple-400 border-purple-500/20',
  rose: 'from-rose-500/20 to-rose-500/5 text-rose-400 border-rose-500/20',
  indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-400 border-indigo-500/20',
  violet: 'from-violet-500/20 to-violet-500/5 text-violet-400 border-violet-500/20',
  zinc: 'from-zinc-500/20 to-zinc-500/5 text-zinc-400 border-zinc-500/20',
  cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/20',
  orange: 'from-orange-500/20 to-orange-500/5 text-orange-400 border-orange-500/20',
};

const iconBgStyles = {
  blue: 'bg-blue-500/20 text-blue-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/20 text-purple-400',
  rose: 'bg-rose-500/20 text-rose-400',
  indigo: 'bg-indigo-500/20 text-indigo-400',
  violet: 'bg-violet-500/20 text-violet-400',
  zinc: 'bg-zinc-500/20 text-zinc-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
  orange: 'bg-orange-500/20 text-orange-400',
};

export function KpiCard({ title, value, icon: Icon, color, loading, subtitle }: KpiCardProps) {
  return (
    <div className={cn("glass-card overflow-hidden relative group p-5 transition-all duration-300 h-full flex flex-col justify-center", `bg-gradient-to-br ${colorStyles[color]}`)}>
      <div className="flex items-center justify-between relative z-10 w-full">
        <div>
          <p className="text-zinc-400 text-sm font-medium mb-1">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-white/10 animate-pulse rounded-lg mt-1"></div>
          ) : (
            <div className="flex items-baseline gap-2">
              <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
              {subtitle && <span className="text-xs text-zinc-500 font-medium">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-xl transition-transform duration-300 group-hover:scale-110", iconBgStyles[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      {/* Decorative background glow */}
      <div className={cn(
        "absolute -right-8 -bottom-8 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity duration-300 group-hover:opacity-40",
        iconBgStyles[color].replace('bg-', 'bg-').split(' ')[0] // extract just the bg color
      )}></div>
    </div>
  );
}
