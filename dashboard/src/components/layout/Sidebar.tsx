'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Settings,
  Users,
  Globe,
  ChevronDown,
  ChevronRight,
  Wallet,
  Truck,
  Package,
  UserCheck,
  Lightbulb,
  HeadphonesIcon,
  LogOut,
} from 'lucide-react';

type SubItem = { name: string; href: string; adminOnly?: boolean };
type NavItem = { name: string; icon: any; href?: string; subItems?: SubItem[] };

import { cn } from '@/lib/utils';
import { getUser, signOut as authSignOut } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';

const navItems: NavItem[] = [
  { name: 'General', href: '/', icon: LayoutDashboard },
  { 
    name: 'Ventas', 
    icon: ShoppingCart,
    subItems: [
      { name: 'Resumen', href: '/ventas' },
      { name: 'Indicadores (KPIs)', href: '/ventas/kpis' },
      { name: 'Análisis de Productos', href: '/ventas/productos' },
    ]
  },
  {
    name: 'Inteligencia de Mercado',
    icon: Lightbulb,
    subItems: [
      { name: 'Resumen', href: '/inteligencia-mercado' },
      { name: 'Tendencias', href: '/inteligencia-mercado/trends' },
      { name: 'Competitividad', href: '/inteligencia-mercado/competitividad' },
      { name: 'Dimensión de Mercado', href: '/inteligencia-mercado/dimension' },
      { name: 'Posicionamiento Shopping', href: '/inteligencia-mercado/shopping-position' },
      { name: 'Lanzamientos', href: '/inteligencia-mercado/lanzamientos' },
    ]
  },
  { 
    name: 'Tráfico', 
    icon: Globe,
    subItems: [
      { name: 'General', href: '/trafico/general' },
      { name: 'Orgánico (Search Console)', href: '/trafico/organico' },
      { name: 'Pagado (Google Ads)', href: '/trafico/pagado-google' },
      { name: 'Pagado (Meta Ads)', href: '/trafico/pagado-meta' },
    ]
  },
  { 
    name: 'Marketing', 
    icon: BarChart3,
    subItems: [
      { name: 'Resumen', href: '/marketing' },
      { name: 'Email (Klaviyo)', href: '/marketing/email' },
      { name: 'Reseñas (Yotpo)', href: '/marketing/reviews' },
      { name: 'Ads (Próximamente)', href: '/marketing/ads' },
    ]
  },
  { 
    name: 'Servicio al Cliente', 
    icon: HeadphonesIcon,
    subItems: [
      { name: 'Mensajería CRM (Crisp)', href: '/servicio-cliente/mensajeria' },
      { name: 'Llamadas (RingCentral)', href: '/servicio-cliente/llamadas' },
    ]
  },
  { 
    name: 'Equipo', 
    icon: Users,
    subItems: [
      { name: 'Actividad y Atribución', href: '/equipo/actividad' },
    ]
  },
  { 
    name: 'Finanzas', 
    icon: Wallet,
    subItems: [
      { name: 'Márgenes y P&L', href: '/finanzas/pnl' },
      { name: 'Gastos Fijos', href: '/finanzas/gastos' },
    ]
  },
  { 
    name: 'Compras', 
    icon: Truck,
    subItems: [
      { name: 'Órdenes de Compra', href: '/compras/ordenes' },
      { name: 'Proveedores', href: '/compras/proveedores' },
    ]
  },
  { 
    name: 'Operaciones', 
    icon: Package,
    subItems: [
      { name: 'Inventario y Stock', href: '/operaciones/inventario' },
      { name: 'Fulfillment', href: '/operaciones/fulfillment' },
      { name: 'Devoluciones', href: '/operaciones/devoluciones' },
    ]
  },
  { 
    name: 'Clientes', 
    icon: UserCheck,
    subItems: [
      { name: 'Retención (LTV)', href: '/clientes/retencion' },
      { name: 'Segmentación', href: '/clientes/segmentacion' },
    ]
  },
];



export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [profile, setProfile] = useState<AuthUser | null>(null);

  useEffect(() => {
    getUser().then((user) => {
      if (user) setProfile(user);
    });
  }, []);

  // Auto-expand parent if a child is active
  useEffect(() => {
    const newExpanded = { ...expandedItems };
    let hasChanges = false;
    navItems.forEach(item => {
      const visible = item.subItems?.filter(sub => !sub.adminOnly || profile?.role === 'admin') ?? [];
      if (visible.some(sub => pathname.startsWith(sub.href))) {
        if (!newExpanded[item.name]) {
          newExpanded[item.name] = true;
          hasChanges = true;
        }
      }
    });
    if (hasChanges) setExpandedItems(newExpanded);
  }, [pathname, profile]);

  const toggleExpand = (name: string) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside className="w-64 h-[calc(100vh-2rem)] fixed top-4 left-4 border border-white/10 bg-zinc-950/40 backdrop-blur-3xl shadow-2xl shadow-black/50 z-50 flex flex-col rounded-3xl overflow-hidden">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tighter text-white flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-sm">GS</span>
          </div>
          GSM<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">PRO</span>
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navItems.map((item) => {
          const hasSubItems = !!item.subItems;
          const visibleSubItems = hasSubItems
            ? item.subItems!.filter(sub => !sub.adminOnly || profile?.role === 'admin')
            : [];
          if (hasSubItems && visibleSubItems.length === 0) return null;
          const isActive = pathname === item.href || (hasSubItems && visibleSubItems.some(sub => pathname === sub.href));
          const isExpanded = expandedItems[item.name];

          return (
            <div key={item.name}>
              {hasSubItems ? (
                <button
                  onClick={() => toggleExpand(item.name)}
                  className={cn(
                    "w-full group relative flex items-center justify-between px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-300 outline-none",
                    isActive && !isExpanded
                      ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn("w-4 h-4 transition-colors duration-300", isActive ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                    {item.name}
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                </button>
              ) : (
                <Link
                  href={item.href!}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-300",
                    pathname === item.href 
                      ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {pathname === item.href && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                  )}
                  <item.icon className={cn("w-4 h-4 transition-colors duration-300", pathname === item.href ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                  {item.name}
                </Link>
              )}

              {/* Sub-items list */}
              {hasSubItems && isExpanded && (
                <div className="mt-1 mb-2 ml-4 pl-4 border-l border-white/10 space-y-1 overflow-hidden transition-all duration-300">
                  {visibleSubItems.map((sub) => (
                    <Link
                      key={sub.name}
                      href={sub.href}
                      className={cn(
                        "block px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-300",
                        pathname === sub.href
                          ? "bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
                          : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                      )}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-2">
        <div className="relative overflow-hidden group p-4 rounded-2xl flex items-center gap-3 border border-white/5 bg-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30 shrink-0">
            {(profile?.full_name?.[0] ?? profile?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{profile?.full_name ?? 'Usuario'}</p>
            <p className="text-xs text-zinc-400 truncate">{profile?.email ?? ''}</p>
          </div>
          <button
            onClick={async () => {
              await authSignOut();
            }}
            title="Cerrar sesión"
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
