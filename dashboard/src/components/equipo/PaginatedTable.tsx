'use client';

import { useRef, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export interface EventData {
  audit_id: string;
  occurred_at: { value: string };
  full_name: string;
  action: string;
  subject_type: string;
  subject_id: string;
}

interface PaginatedTableProps {
  events: EventData[];
  currentPage: number;
  totalPages: number;
  totalEvents: number;
  limit: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function PaginatedTable({ 
  events, 
  currentPage, 
  totalPages, 
  totalEvents, 
  limit, 
  loading, 
  onPageChange, 
  onLimitChange 
}: PaginatedTableProps) {
  
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalEvents);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (containerRef.current) {
      const y = containerRef.current.getBoundingClientRect().top + window.scrollY - 40;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [currentPage]);

  return (
    <Card ref={containerRef} className="bg-slate-900/60 border-slate-800 backdrop-blur-xl overflow-hidden flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-400" />
          Historial de Eventos
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>Mostrar:</span>
          <select 
            value={limit} 
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500 transition-colors"
            disabled={loading}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1 relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-sm uppercase tracking-wider sticky top-0 z-0">
                <th className="p-4 font-semibold whitespace-nowrap">Fecha y Hora</th>
                <th className="p-4 font-semibold">Empleado</th>
                <th className="p-4 font-semibold">Acción</th>
                <th className="p-4 font-semibold">Recurso</th>
                <th className="p-4 font-semibold text-right">ID Referencia</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800/50">
              {events.map((evt, idx) => {
                const dateStr = evt.occurred_at?.value || evt.occurred_at as unknown as string;
                const displayDate = dateStr ? new Date(dateStr).toLocaleString() : '-';
                
                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-300 whitespace-nowrap">
                      {displayDate}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-xs font-bold text-slate-900 flex-shrink-0">
                          {evt.full_name ? evt.full_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <span className="font-medium whitespace-nowrap">{evt.full_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20 whitespace-nowrap">
                        {evt.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 capitalize whitespace-nowrap">
                      {evt.subject_type?.toLowerCase().replace('_', ' ') || 'N/A'}
                    </td>
                    <td className="p-4 text-right text-slate-500 font-mono text-xs whitespace-nowrap">
                      {evt.subject_id || '-'}
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">No hay eventos para el filtro seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="border-t border-slate-800/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 mt-auto">
          <div className="text-sm text-slate-400">
            Mostrando {totalEvents > 0 ? startItem : 0} a {endItem} de <span className="font-semibold text-slate-200">{totalEvents}</span> registros
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              title="Primera página"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="px-3 py-1 text-sm font-medium text-slate-300">
              Página {currentPage} de {totalPages || 1}
            </div>
            
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              title="Página siguiente"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages || loading}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              title="Última página"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
