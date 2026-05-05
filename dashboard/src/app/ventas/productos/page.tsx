'use client';

import { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Download,
  Package,
  Tag
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { cn } from '@/lib/utils';

interface TopProduct {
  productId: string;
  title: string;
  brand: string;
  quantity: number;
  revenue: number;
  seoPosition: number | null;
}

interface TopBrand {
  brand: string;
  quantity: number;
  revenue: number;
}

interface ProductApiResponse {
  topProducts: TopProduct[];
  topBrands: TopBrand[];
}

const COLORS = ['#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

export default function VentasProductosPage() {
  const [data, setData] = useState<ProductApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ventas/productos?startDate=${startDate}T00:00:00Z&endDate=${endDate}T23:59:59Z`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const handleExportCSV = () => {
    if (!data) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Top Products
    csvContent += "TOP PRODUCTOS\n";
    csvContent += "Producto,Marca,Cantidad Vendida,Ingresos (Pagados),Posicion SEO Promedio\n";
    data.topProducts.forEach(p => {
      // Escape commas in titles
      const safeTitle = p.title ? p.title.replace(/,/g, '') : '';
      const safeBrand = p.brand ? p.brand.replace(/,/g, '') : '';
      const seo = p.seoPosition ? p.seoPosition.toFixed(1) : 'N/A';
      csvContent += `${safeTitle},${safeBrand},${p.quantity},${p.revenue},${seo}\n`;
    });
    
    csvContent += "\nTOP MARCAS\n";
    csvContent += "Marca,Cantidad Vendida,Ingresos (Pagados)\n";
    data.topBrands.forEach(b => {
      const safeBrand = b.brand ? b.brand.replace(/,/g, '') : '';
      csvContent += `${safeBrand},${b.quantity},${b.revenue}\n`;
    });
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ventas_productos_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!mounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Ventas: Análisis de Productos</h1>
          <p className="text-zinc-400 mt-1">Rendimiento por SKU, Variantes y Marcas.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-zinc-900/50 border border-white/10 p-1.5 rounded-xl backdrop-blur-md">
            <CalendarDays className="w-4 h-4 text-zinc-400 ml-2" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
            <span className="text-zinc-500">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-white focus:outline-none px-2"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-colors text-sm font-medium border border-white/5"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Brands Chart */}
        <div className="lg:col-span-1 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl flex flex-col relative overflow-hidden group">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <Tag className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Top 10 Marcas</h2>
          </div>
          
          <div className="relative z-10 w-full" style={{ height: data?.topBrands ? Math.max(150, data.topBrands.slice(0, 10).length * 45 + 50) : 350 }}>
            {loading ? (
              <div className="w-full h-[350px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : data && data.topBrands && data.topBrands.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={data.topBrands.slice(0, 10)} 
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#52525b" fontSize={12} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="brand" stroke="#52525b" fontSize={11} width={80} />
                  <RechartsTooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '0.75rem', color: '#fff' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Ingresos']}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {data.topBrands.slice(0, 10).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-[350px] flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        {/* Top Products Table */}
        <div className="lg:col-span-2 p-6 rounded-2xl border border-white/10 bg-zinc-950/50 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white">Ranking de Productos (Top 50)</h2>
          </div>
          
          <div className="relative z-10 overflow-x-auto">
            {loading ? (
              <div className="w-full h-48 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              </div>
            ) : data && data.topProducts && data.topProducts.length > 0 ? (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Producto</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3 text-right">Ingresos</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Pos. SEO</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.slice(0, 50).map((product, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-zinc-200 truncate max-w-[200px]" title={product.title}>
                        {product.title}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {product.brand}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-400">
                        {product.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {formatCurrency(product.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-purple-400 font-mono text-xs">
                        {product.seoPosition ? product.seoPosition.toFixed(1) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-zinc-500">No hay datos</div>
            )}
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        </div>

      </div>
    </div>
  );
}
