import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { InventoryItem } from '@/src/types';
import { Box, Plus, Search, AlertTriangle, ArrowUpDown, MoreVertical, PackageCheck, History } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function InventoryModule() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'inventory'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(docs.length > 0 ? docs : [
        { name: 'MacBook Pro M3', sku: 'LAP-001', quantity: 15, price: 14500, category: 'Hardware', lastRestocked: new Date() },
        { name: 'Monitor 4K Dell', sku: 'MON-042', quantity: 4, price: 3200, category: 'Acessórios', lastRestocked: new Date() },
        { name: 'Teclado Mecânico', sku: 'PER-009', quantity: 38, price: 850, category: 'Periféricos', lastRestocked: new Date() },
        { name: 'Cadeira Ergonômica', sku: 'FUR-772', quantity: 2, price: 1800, category: 'Móveis', lastRestocked: new Date() },
      ]);
    });
    return () => unsubscribe();
  }, []);

  const lowStockCount = items.filter(i => i.quantity < 5).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestão de Estoque</h2>
          <p className="text-zinc-500">Monitoramento e suprimento de ativos da empresa.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 text-zinc-600 hover:text-zinc-800 bg-white border border-zinc-200 px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <History className="w-5 h-5 text-zinc-400" />
            <span className="font-semibold">Histórico</span>
          </button>
          <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Novo Item</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total de Itens</p>
            <p className="text-xl font-black text-zinc-900">{items.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Valor Total</p>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(items.reduce((acc, i) => acc + (i.price * i.quantity), 0))}</p>
          </div>
        </div>
        <div className={cn(
          "p-4 rounded-xl border flex items-center space-x-4",
          lowStockCount > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-zinc-200"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center border",
            lowStockCount > 0 ? "bg-amber-100 text-amber-600 border-amber-200" : "bg-zinc-50 text-zinc-400 border-zinc-200"
          )}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Estoque Baixo</p>
            <p className="text-xl font-black">{lowStockCount} alertas</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-zinc-50 text-zinc-500 flex items-center justify-center border border-zinc-200">
            <ArrowUpDown className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Movimentação/Mes</p>
            <p className="text-xl font-black text-zinc-900">124</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Pesquisar por SKU ou nome..." 
              className="w-full bg-white border border-zinc-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" 
            />
          </div>
          <div className="flex space-x-2">
            <button className="text-xs font-bold bg-white border border-zinc-200 text-zinc-600 px-3 py-2 rounded-lg hover:bg-zinc-50">Categoria</button>
            <button className="text-xs font-bold bg-white border border-zinc-200 text-zinc-600 px-3 py-2 rounded-lg hover:bg-zinc-50">Menor Estoque</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-16">Foto</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Item & SKU</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Categoria</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Quantidade</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Preço Unitário</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {items.map((item, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  key={item.id || item.sku} 
                  className="hover:bg-zinc-50/50 group"
                >
                  <td className="px-6 py-4">
                    <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-400 border border-zinc-200 group-hover:scale-110 transition-transform">
                      <Box className="w-6 h-6" />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{item.name}</p>
                    <p className="text-xs font-mono text-zinc-400 mt-1">{item.sku}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">{item.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <p className={cn(
                        "text-sm font-black",
                        item.quantity < 5 ? "text-red-500" : "text-emerald-600"
                      )}>{item.quantity}</p>
                      <div className="w-16 h-1.5 bg-zinc-100 rounded-full mt-1.5 overflow-hidden border border-zinc-200">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            item.quantity < 5 ? "bg-red-500 w-1/4" : "bg-emerald-500 w-3/4"
                          )}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-zinc-900">
                    {formatCurrency(item.price)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-all">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
