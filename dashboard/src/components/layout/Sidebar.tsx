'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  BarChart3, 
  MessageCircle, 
  Settings 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'General', href: '/', icon: LayoutDashboard },
  { name: 'Ventas (Shopify)', href: '/sales', icon: ShoppingCart },
  { name: 'Marketing (Ads & Email)', href: '/marketing', icon: BarChart3 },
  { name: 'Soporte (Crisp)', href: '/support', icon: MessageCircle },
  { name: 'Configuración', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen fixed top-0 left-0 border-r border-white/5 bg-zinc-950/80 backdrop-blur-xl z-50 flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tighter text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">GS</span>
          </div>
          GSM<span className="text-blue-500">PRO</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-blue-400" : "text-zinc-500")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="glass-panel p-4 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
            A
          </div>
          <div>
            <p className="text-sm font-medium text-white">Admin</p>
            <p className="text-xs text-zinc-500">admin@gsmpro.cl</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
