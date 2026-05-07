'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Cpu, RefreshCcw, Search, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';

export default function MarketIntelligencePage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inteligencia-mercado/lanzamientos');
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/inteligencia-mercado/lanzamientos', { method: 'POST' });
      const json = await res.json();
      alert(json.message || "Escaneo finalizado");
      loadData();
    } catch (e) {
      alert("Error ejecutando el rastreo de IA.");
    } finally {
      setScanning(false);
    }
  };

  // Agrupar por fecha de escaneo
  const groupedData = data.reduce((acc: any, curr: any) => {
    const scanDate = curr.fecha_escaneo || 'Sin fecha';
    if (!acc[scanDate]) acc[scanDate] = [];
    acc[scanDate].push(curr);
    return acc;
  }, {});

  // Obtener fechas únicas ordenadas (más reciente primero) y proteger contra invalid dates
  const availableScans = Object.keys(groupedData).sort((a, b) => {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    return timeB - timeA;
  });

  // Setear el más reciente por defecto si no hay ninguno seleccionado
  useEffect(() => {
    if (availableScans.length > 0 && !selectedScan) {
      setSelectedScan(availableScans[0]);
    }
  }, [availableScans, selectedScan]);

  const displayData = selectedScan && groupedData[selectedScan] ? groupedData[selectedScan] : [];

  // Preparar datos para gráfica del escaneo seleccionado
  const categoryData = displayData.reduce((acc: any, curr: any) => {
    const cat = curr.categoria || 'Otro';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.keys(categoryData).map(k => ({
    name: k,
    value: categoryData[k]
  }));

  // Colores vibrantes Neon para Dark Mode Premium
  const COLORS = ['#06b6d4', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6'];

  const formatDate = (isoString: string) => {
    if (!mounted) return ''; // Evita Hydration Mismatch
    if (!isoString || isoString === 'Sin fecha') return 'Ejecución desconocida';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Fecha inválida'; // Evita Runtime Error
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient">Inteligencia de Mercado</h1>
          <p className="text-slate-400 mt-2">Monitoreo autónomo de lanzamientos vía Vertex AI.</p>
        </div>
        <button 
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          <RefreshCcw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Escaneando Internet...' : 'Forzar Escaneo IA'}
        </button>
      </div>

      {/* Historial de Ejecuciones (Memoria) */}
      <div className="flex items-center gap-3">
        <Calendar className="w-5 h-5 text-slate-400" />
        <span className="text-slate-300 font-medium">Historial de Escaneos:</span>
        <select 
          className="bg-dark-surface border border-dark-border text-slate-100 rounded-lg px-4 py-2 outline-none focus:border-brand-500 transition-colors cursor-pointer"
          value={selectedScan || ''}
          onChange={(e) => setSelectedScan(e.target.value)}
          disabled={loading || availableScans.length === 0}
        >
          {availableScans.length === 0 && <option>No hay ejecuciones</option>}
          {availableScans.map((scanDate, idx) => (
            <option key={idx} value={scanDate}>
              {idx === 0 ? 'Último Escaneo: ' : 'Escaneo Anterior: '} {formatDate(scanDate)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Gráfico */}
        <div className="md:col-span-1 glass-card animate-slide-up" style={{animationDelay: '0.1s'}}>
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-slate-200">Distribución por Categoría</h3>
          </div>
          <div className="h-64">
            {loading ? <Skeleton className="w-full h-full bg-slate-800/50 rounded-xl" /> : (
              pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(15,15,17,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">Sin datos para esta fecha</div>
              )
            )}
          </div>
        </div>

        {/* Tabla Premium */}
        <div className="md:col-span-2 glass-card animate-slide-up" style={{animationDelay: '0.2s'}}>
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-slate-200">Resultados del Escaneo</h3>
          </div>
          <div className="overflow-hidden rounded-xl border border-dark-border">
            {loading ? <Skeleton className="w-full h-64 bg-slate-800/50" /> : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 sticky top-0 z-10">
                    <tr>
                      <th className="px-5 py-4 font-medium">Producto</th>
                      <th className="px-5 py-4 font-medium">Categoría</th>
                      <th className="px-5 py-4 font-medium">Especificaciones</th>
                      <th className="px-5 py-4 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-border">
                    {displayData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{row.producto}</div>
                          <div className="text-xs text-brand-400 font-normal">{row.marca}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-300">
                          <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/50 text-xs">
                            {row.categoria}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 truncate max-w-[200px]" title={row.especificaciones_clave}>
                          {row.especificaciones_clave}
                        </td>
                        <td className="px-5 py-4">
                          {row.estado_db === 'EXISTENTE' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              <CheckCircle className="w-3.5 h-3.5" /> Catálogo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-pink-500/10 text-pink-400 border border-pink-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Novedad
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayData.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                          No hay productos registrados en esta ejecución.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
