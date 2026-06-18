import React, { useState, useEffect } from 'react';
import { Search, User, Loader2, Users, Package, DollarSign, CheckSquare } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import NotificationCenter from './NotificationCenter';

export default function Header() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length > 2) {
        performGlobalSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const performGlobalSearch = async () => {
    setIsLoading(true);
    try {
      const collectionConfigs = [
        { name: 'employees', icon: Users, field: 'name', type: 'Colaborador' },
        { name: 'inventory', icon: Package, field: 'name', type: 'Produto' },
        { name: 'transactions', icon: DollarSign, field: 'title', type: 'Transação' },
        { name: 'tickets', icon: CheckSquare, field: 'title', type: 'Ticket' }
      ];

      const allResults: any[] = [];
      for (const config of collectionConfigs) {
        const snap = await getDocs(query(collection(db, config.name), limit(5)));
        snap.forEach(doc => {
          const data = doc.data();
          if (data[config.field]?.toLowerCase().includes(searchTerm.toLowerCase())) {
            allResults.push({ 
              id: doc.id, 
              ...data, 
              type: config.type, 
              icon: config.icon, 
              label: data[config.field] 
            });
          }
        });
      }
      setResults(allResults);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="relative w-96">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Pesquisar em todo o ecossistema..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearching(true)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-full py-2 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        <AnimatePresence>
          {isSearching && (searchTerm.length > 0) && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setIsSearching(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full mt-2 w-[480px] bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="p-2 max-h-[400px] overflow-y-auto">
                  {results.length > 0 ? (
                    results.map((res, idx) => (
                      <button 
                        key={`${res.id}-${idx}`} 
                        className="w-full flex items-center space-x-3 p-3 hover:bg-zinc-50 rounded-xl transition-colors text-left group"
                      >
                        <div className="p-2 bg-zinc-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                          <res.icon className="w-4 h-4 text-zinc-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-zinc-900 leading-tight">{res.label}</p>
                          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{res.type}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-zinc-400 text-xs font-semibold">
                        {searchTerm.length < 3 ? 'Digite pelo menos 3 caracteres...' : 'Puxa, nada foi encontrado.'}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center space-x-6">
        <div className="hidden md:flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Sistemas Sincronizados</span>
        </div>
        <NotificationCenter />
        <div className="flex items-center space-x-3 pl-4 border-l border-zinc-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900 leading-tight">Administrador</p>
            <p className="text-xs text-zinc-500">Gestão Global</p>
          </div>
          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200 transition-transform active:scale-95 cursor-pointer">
            <User className="w-6 h-6 text-zinc-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
