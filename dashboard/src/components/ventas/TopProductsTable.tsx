import { Skeleton } from '@/components/ui/Skeleton';
import { Package } from 'lucide-react';

interface TopProductsTableProps {
  products: Array<{ title: string; brand: string; quantity: number; revenue: number }>;
  loading?: boolean;
}

export function TopProductsTable({ products, loading }: TopProductsTableProps) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="glass-card p-6 relative overflow-hidden group h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
          <Package className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-white">Top Productos (Por Ingresos)</h3>
      </div>

      <div className="relative z-10 overflow-x-auto flex-1 flex flex-col">
        {loading ? (
          <div className="w-full flex-1 flex flex-col justify-center space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Producto</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3 text-right">Cant.</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="w-full flex-1 flex items-center justify-center text-zinc-500">
            No hay datos de productos para este rango.
          </div>
        )}
      </div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
    </div>
  );
}
