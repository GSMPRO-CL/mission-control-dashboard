import Link from 'next/link';
import { type LucideIcon, ArrowRight } from 'lucide-react';

interface NavigationCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' | 'cyan' | 'orange' | 'zinc';
}

const colorStyles: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 group-hover:bg-amber-500/20',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400 group-hover:bg-purple-500/20',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-500/20',
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/20',
  cyan: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400 group-hover:bg-orange-500/20',
  zinc: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400 group-hover:bg-zinc-500/20'
};

export function NavigationCard({ title, description, href, icon: Icon, color }: NavigationCardProps) {
  return (
    <Link href={href} className="block h-full">
      <div className="glass-card group p-6 flex flex-col h-full relative overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/[0.02] cursor-pointer">
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className={`p-3 rounded-xl border transition-colors duration-300 ${colorStyles[color]}`}>
            <Icon className="w-5 h-5 drop-shadow-md" />
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 group-hover:translate-x-1 transition-all duration-300">
            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white" />
          </div>
        </div>
        <div className="relative z-10 mt-auto">
          <h3 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
            {title}
          </h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
        </div>
        {/* Subtle background glow on hover */}
        <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${colorStyles[color].split(' ')[0]}`} />
      </div>
    </Link>
  );
}
