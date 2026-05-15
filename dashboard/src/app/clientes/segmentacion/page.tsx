'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  MapPin, 
  TrendingUp, 
  CreditCard,
  Map,
  Activity,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface KPI {
  total_customers: number;
  global_revenue: number;
  global_ltv: number;
  global_recurrence: number;
}

interface GeoData {
  city: string;
  province: string;
  total_customers: number;
  total_revenue: number;
  avg_ltv: number;
  avg_orders: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function SegmentacionClientesPage() {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [geoData, setGeoData] = useState<GeoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/clientes/segmentacion');
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error fetching data');
      }

      setKpis(data.data.kpis);
      setGeoData(data.data.geographicDistribution);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat('es-CL').format(val || 0);
  };

  // Mock data for UI scalability preparation (Age/Gender) as requested by user
  const mockAgeData = [
    { name: '18-24', value: 0 },
    { name: '25-34', value: 0 },
    { name: '35-44', value: 0 },
    { name: '45-54', value: 0 },
    { name: '55+', value: 0 },
  ];

  const mockGenderData = [
    { name: 'Masculino', value: 0 },
    { name: 'Femenino', value: 0 },
    { name: 'No Espec.', value: 100 }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Buyer Persona & Segmentación
        </h1>
        <p className="text-zinc-400 mt-2">
          Análisis demográfico y geográfico del comportamiento de los clientes.
        </p>
      </motion.div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard 
          title="Total Clientes (Con Compras)" 
          value={loading ? '...' : formatNumber(kpis?.total_customers || 0)} 
          icon={<Users size={20} className="text-blue-400" />}
          loading={loading}
        />
        <KPICard 
          title="Lifetime Value (LTV) Promedio" 
          value={loading ? '...' : formatCurrency(kpis?.global_ltv || 0)} 
          icon={<TrendingUp size={20} className="text-emerald-400" />}
          loading={loading}
        />
        <KPICard 
          title="Recurrencia Promedio" 
          value={loading ? '...' : `${(kpis?.global_recurrence || 0).toFixed(2)} pedidos`} 
          icon={<Activity size={20} className="text-purple-400" />}
          loading={loading}
        />
        <KPICard 
          title="Top Ciudad" 
          value={loading ? '...' : (geoData.length > 0 ? geoData[0].city : 'N/A')} 
          icon={<MapPin size={20} className="text-rose-400" />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Geographic Distribution Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-[#111] border border-white/5 p-6 rounded-2xl shadow-xl"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Map size={20} className="text-blue-400" />
              Distribución Geográfica (Top 10 Ciudades)
            </h2>
          </div>
          
          <div className="h-[350px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : geoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={geoData.slice(0, 10)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="city" 
                    stroke="#888" 
                    tick={{ fill: '#888', fontSize: 12 }} 
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any, name: any) => [
                      name === 'total_customers' ? formatNumber(value) : formatCurrency(value), 
                      name === 'total_customers' ? 'Clientes' : 'LTV Promedio'
                    ]}
                  />
                  <Bar dataKey="total_customers" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Clientes" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500">
                No hay datos disponibles
              </div>
            )}
          </div>
        </motion.div>

        {/* Demographics Area (Prepared for future GA4 integration) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111] border border-white/5 p-6 rounded-2xl shadow-xl flex flex-col"
        >
          <div className="mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users size={20} className="text-purple-400" />
              Distribución por Género
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Preparado para integración GA4 Demographics</p>
          </div>
          
          <div className="flex-1 min-h-[250px] relative">
             {/* Backdrop Blur to indicate it's not active yet */}
             <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-black/40 flex items-center justify-center rounded-xl border border-dashed border-zinc-700">
                <span className="text-zinc-400 font-medium px-4 py-2 bg-black/80 rounded-lg">Datos GA4 Pendientes</span>
             </div>
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mockGenderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {mockGenderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
             </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Geodata Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[#111] border border-white/5 rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin size={20} className="text-emerald-400" />
            Desglose Geográfico Completo
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-zinc-400 text-sm">
                <th className="p-4 font-medium">Ciudad</th>
                <th className="p-4 font-medium">Región / Provincia</th>
                <th className="p-4 font-medium">Total Clientes</th>
                <th className="p-4 font-medium">LTV Promedio</th>
                <th className="p-4 font-medium">Recurrencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                 Array.from({ length: 5 }).map((_, i) => (
                   <tr key={i} className="animate-pulse">
                     <td className="p-4"><div className="h-4 bg-white/5 rounded w-24"></div></td>
                     <td className="p-4"><div className="h-4 bg-white/5 rounded w-32"></div></td>
                     <td className="p-4"><div className="h-4 bg-white/5 rounded w-16"></div></td>
                     <td className="p-4"><div className="h-4 bg-white/5 rounded w-20"></div></td>
                     <td className="p-4"><div className="h-4 bg-white/5 rounded w-12"></div></td>
                   </tr>
                 ))
              ) : geoData.length > 0 ? (
                geoData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{row.city}</td>
                    <td className="p-4 text-zinc-400">{row.province}</td>
                    <td className="p-4 text-blue-400">{formatNumber(row.total_customers)}</td>
                    <td className="p-4 text-emerald-400">{formatCurrency(row.avg_ltv)}</td>
                    <td className="p-4 text-purple-400">{row.avg_orders.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    No se encontraron datos geográficos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

function KPICard({ title, value, icon, loading }: { title: string, value: string | React.ReactNode, icon: React.ReactNode, loading: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#111] border border-white/5 p-6 rounded-2xl shadow-xl flex items-center gap-4 hover:border-white/10 transition-colors"
    >
      <div className="p-3 bg-white/5 rounded-xl">
        {icon}
      </div>
      <div>
        <p className="text-zinc-400 text-sm">{title}</p>
        <h3 className="text-2xl font-bold text-white mt-1">
          {loading ? (
             <div className="h-8 bg-white/5 rounded animate-pulse w-24"></div>
          ) : value}
        </h3>
      </div>
    </motion.div>
  );
}
