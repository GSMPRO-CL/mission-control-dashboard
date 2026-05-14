'use client';

import { useState, useRef, useEffect } from 'react';
import { Users, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StaffMember {
  staff_id: string;
  full_name: string;
}

interface StaffFilterProps {
  staffList: StaffMember[];
  onChange: (selectedIds: string[]) => void;
}

export function StaffFilter({ staffList, onChange }: StaffFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleStaff = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    onChange(Array.from(newSelected));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    onChange([]);
    setIsOpen(false);
  };



  return (
    <div className="relative flex flex-col gap-2" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl backdrop-blur-md transition-colors text-sm text-slate-200"
      >
        <Users className="w-4 h-4 text-slate-400" />
        <span className="font-medium">
          {selectedIds.size === 0 
            ? "Todos los empleados" 
            : selectedIds.size === 1
              ? (staffList.find(s => s.staff_id === Array.from(selectedIds)[0])?.full_name || 'Desconocido')
              : `${selectedIds.size} seleccionados`}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="p-2 border-b border-slate-800 flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Filtrar por Empleado</span>
            {selectedIds.size > 0 && (
              <button 
                onClick={clearSelection}
                className="text-xs text-rose-400 hover:text-rose-300"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
            {staffList.map((staff) => {
              const isSelected = selectedIds.has(staff.staff_id);
              return (
                <button
                  key={staff.staff_id}
                  onClick={() => toggleStaff(staff.staff_id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left",
                    isSelected 
                      ? "bg-emerald-500/10 text-emerald-400" 
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  <span className="truncate pr-2">{staff.full_name}</span>
                  {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
            {staffList.length === 0 && (
              <div className="p-3 text-sm text-slate-500 text-center">No hay empleados disponibles</div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
