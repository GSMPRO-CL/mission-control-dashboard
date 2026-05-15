'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Clock, 
  AlertCircle,
  Truck,
  FileText,
  MessageCircle,
  CheckCircle,
  RefreshCcw,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Helper to determine status style and icon
const getStatusInfo = (statusText: string) => {
  if (!statusText) return { color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: AlertCircle, label: 'Desconocido' };
  
  if (statusText.startsWith('0')) {
    return { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock, label: statusText };
  } else if (statusText.startsWith('1')) {
    return { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: FileText, label: statusText };
  } else if (statusText.startsWith('2')) {
    return { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: MessageCircle, label: statusText };
  } else if (statusText.startsWith('3')) {
    return { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle, label: statusText };
  } else if (statusText.startsWith('4')) {
    return { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: statusText };
  } else if (statusText.startsWith('5')) {
    return { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: RefreshCcw, label: statusText };
  }
  
  return { color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', icon: Package, label: statusText };
};

export default function PedidosPorComprarPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/compras/pedidos');
        const data = await res.json();
        if (data.success) {
          setOrders(data.data);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number?.toString().includes(searchTerm) || 
      order.lines?.some((l: any) => l.title?.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesStatus = statusFilter === 'all' || order.estado_de_pedido?.startsWith(statusFilter);
    
    return matchesSearch && matchesStatus;
  });

  const totalAmount = filteredOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);
  const currencyStr = filteredOrders.length > 0 ? filteredOrders[0].currency : 'CLP'; // Defaulting or inferring currency

  return (
    <div className="min-h-screen bg-[#050505] p-8 pl-80 text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end justify-between">
          <div className="space-y-2">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium"
            >
              <Truck className="w-4 h-4" />
              <span>Compras</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400"
            >
              Pedidos por comprar
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-zinc-400 text-lg max-w-2xl"
            >
              Gestiona las órdenes abiertas que requieren acción de compra o seguimiento con proveedores.
            </motion.p>
          </div>

          {/* Quick Stats */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-6 p-5 rounded-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-xl"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-500">Pedidos Activos</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{filteredOrders.length}</span>
                <span className="text-sm text-blue-400">órdenes</span>
              </div>
            </div>
            <div className="w-px h-12 bg-white/10"></div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-500">Total Pendiente</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: currencyStr }).format(totalAmount)}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters Bar */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-3xl bg-zinc-900/40 border border-white/5 backdrop-blur-xl flex flex-col md:flex-row gap-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar por # orden o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {['all', '0', '1', '2', '3', '4', '5'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm font-medium whitespace-nowrap transition-all border",
                  statusFilter === status 
                    ? "bg-white/10 text-white border-white/20 shadow-lg shadow-black/20" 
                    : "bg-black/20 text-zinc-400 border-white/5 hover:bg-white/5 hover:text-zinc-300"
                )}
              >
                {status === 'all' ? 'Todos los estados' : `Estado ${status}`}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-zinc-900/20 border border-white/5 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredOrders.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-20 flex flex-col items-center justify-center text-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/10"
          >
            <div className="w-16 h-16 mb-4 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
              <Package className="w-8 h-8 text-zinc-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No se encontraron pedidos</h3>
            <p className="text-zinc-400 max-w-md">No hay órdenes que coincidan con los filtros actuales o no existen órdenes pendientes de compra.</p>
          </motion.div>
        )}

        {/* Orders List */}
        {!loading && filteredOrders.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {filteredOrders.map((order, index) => {
                const isExpanded = expandedOrder === order.id;
                const statusInfo = getStatusInfo(order.estado_de_pedido);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group rounded-3xl bg-zinc-900/30 border border-white/5 hover:border-white/10 hover:bg-zinc-900/50 transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Header (Always Visible) */}
                    <div 
                      className="p-5 sm:p-6 cursor-pointer flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center shadow-inner">
                          <Package className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                            #{order.order_number}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-zinc-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(order.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md", statusInfo.color)}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{statusInfo.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">{order.currency} {order.total_price.toLocaleString()}</p>
                            <p className="text-xs text-zinc-500">{order.lines?.length || 0} ítems</p>
                          </div>
                          
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center transition-all bg-black/30 border border-white/5",
                            isExpanded ? "rotate-180 bg-white/10" : ""
                          )}>
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Body (Expanded) */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/5 bg-black/20"
                        >
                          <div className="p-6">
                            <h4 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">Detalles de Productos</h4>
                            <div className="space-y-3">
                              {order.lines?.map((line: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-white/5">
                                  <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-sm font-medium text-zinc-200 truncate">{line.title}</p>
                                    <p className="text-xs text-zinc-500 mt-1">Proveedor: {line.vendor || 'N/A'}</p>
                                  </div>
                                  <div className="flex items-center gap-6 shrink-0">
                                    <div className="text-center">
                                      <p className="text-xs text-zinc-500">Cant</p>
                                      <p className="text-sm font-medium text-white">{line.quantity}</p>
                                    </div>
                                    <div className="text-right w-24">
                                      <p className="text-xs text-zinc-500">Precio unit.</p>
                                      <p className="text-sm font-medium text-white">{order.currency} {line.price.toLocaleString()}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
