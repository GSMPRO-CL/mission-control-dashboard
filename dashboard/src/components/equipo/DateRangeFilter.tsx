'use client';

import { useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangeFilterProps {
  initialStartDate: string;
  initialEndDate: string;
  onChange: (range: DateRange) => void;
}

export function DateRangeFilter({ initialStartDate, initialEndDate, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // State that holds the currently confirmed range (shown on button)
  const [activeRange, setActiveRange] = useState({ start: initialStartDate, end: initialEndDate });
  const [activePreset, setActivePreset] = useState<string>('Mes');
  
  // Local state for the popover inputs (only applied on 'Aplicar' or preset click)
  const [localStart, setLocalStart] = useState(initialStartDate);
  const [localEnd, setLocalEnd] = useState(initialEndDate);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset local state if closed without applying
        setLocalStart(activeRange.start);
        setLocalEnd(activeRange.end);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeRange]);

  const toYMD = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const applyRange = (start: string, end: string, presetName: string) => {
    setActiveRange({ start, end });
    setLocalStart(start);
    setLocalEnd(end);
    setActivePreset(presetName);
    setIsOpen(false);
    onChange({ startDate: start, endDate: end });
  };

  const applyPreset = (preset: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'Hoy':
        break;
      case 'Ayer':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'Hace 3 Días':
        start.setDate(today.getDate() - 3);
        break;
      case 'Semana':
        start.setDate(today.getDate() - 7);
        break;
      case 'Mes':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'Trimestre':
        const quarter = Math.floor(today.getMonth() / 3);
        start = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case 'Año':
        start = new Date(today.getFullYear(), 0, 1);
        break;
    }

    applyRange(toYMD(start), toYMD(end), preset);
  };

  const handleCustomApply = () => {
    applyRange(localStart, localEnd, 'Custom');
  };

  const presets = ['Hoy', 'Ayer', 'Hace 3 Días', 'Semana', 'Mes', 'Trimestre', 'Año'];

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-slate-900/50 hover:bg-slate-800/80 border border-slate-700 px-4 py-2 rounded-xl backdrop-blur-md transition-colors text-sm text-slate-200"
      >
        <CalendarDays className="w-4 h-4 text-emerald-400" />
        <span className="font-medium tracking-wide">
          {formatDateLabel(activeRange.start)} — {formatDateLabel(activeRange.end)}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-slate-500 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col sm:flex-row w-[320px] sm:w-[480px]">
          
          {/* Left Side: Presets */}
          <div className="flex flex-col border-b sm:border-b-0 sm:border-r border-slate-800 p-2 sm:w-1/3 bg-slate-900/80">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">Rápidos</span>
            <div className="flex flex-col gap-1">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "text-left px-3 py-2 text-sm rounded-lg transition-colors",
                    activePreset === preset 
                      ? "bg-emerald-500/10 text-emerald-400 font-medium" 
                      : "text-slate-300 hover:bg-slate-800"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Custom Date Range */}
          <div className="flex flex-col p-4 sm:w-2/3 bg-slate-900 gap-4">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rango Personalizado</span>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Desde</label>
                <input 
                  type="date" 
                  value={localStart}
                  onChange={(e) => {
                    setLocalStart(e.target.value);
                    setActivePreset('Custom');
                  }}
                  className="bg-slate-950 border border-slate-700 text-sm text-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 px-3 py-2 w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-slate-400">Hasta</label>
                <input 
                  type="date" 
                  value={localEnd}
                  onChange={(e) => {
                    setLocalEnd(e.target.value);
                    setActivePreset('Custom');
                  }}
                  className="bg-slate-950 border border-slate-700 text-sm text-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 px-3 py-2 w-full"
                />
              </div>
            </div>

            <div className="mt-auto pt-4 flex justify-end">
              <button 
                onClick={handleCustomApply}
                className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
