'use client';

import { Bell, Search, RefreshCw } from 'lucide-react';

export function Header() {
  return (
    <header className="h-20 border-b border-white/5 bg-zinc-950/50 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Buscar KPIs, órdenes, productos..." 
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/10 text-blue-400 text-sm font-medium hover:bg-blue-600/20 transition-all border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
          <RefreshCw className="w-4 h-4" />
          Sincronizar Manual
        </button>
        
        <button className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
        </button>
      </div>
    </header>
  );
}
