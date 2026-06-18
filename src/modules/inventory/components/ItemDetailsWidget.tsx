import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Box, Laptop, Tag, MapPin, Hash, User, 
  Calendar, ShieldCheck, History, ArrowUpRight, 
  ArrowDownLeft, Settings, Trash2, ClipboardList,
  Wrench, ExternalLink, Download, AlertCircle,
  Truck, DollarSign, Package, ArrowUpDown
} from 'lucide-react';
import { InventoryItem, Asset, StockMovement, AuditLog } from '@/src/types';
import { cn, formatCurrency } from '@/src/lib/utils';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { format } from 'date-fns';

interface ItemDetailsWidgetProps {
  item: InventoryItem;
  onClose: () => void;
  onMovement: () => void;
  onTransfer?: () => void;
  userRole?: string;
}

export default function ItemDetailsWidget({ 
  item, 
  onClose, 
  onMovement,
  onTransfer,
  userRole 
}: ItemDetailsWidgetProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'audit'>('overview');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    if (!item.id) return;

    // Fetch Movements
    const qMov = query(
      collection(db, 'movements'),
      where('itemId', '==', item.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubMov = onSnapshot(qMov, (snap) => {
      setMovements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement)));
    });

    // Fetch Audit Logs
    const qAudit = query(
      collection(db, 'auditLogs'),
      where('resource', '==', 'inventory'),
      where('resourceId', '==', item.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    // Fetch Tickets if Asset
    if (item.type === 'asset' && item.sku) {
        const qTickets = query(
            collection(db, 'tickets'),
            where('description', '>=', item.sku), // Simplistic search for SKU in description
            limit(5)
        );
        const unsubTickets = onSnapshot(qTickets, (snap) => {
            const filtered = snap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter((t: any) => t.description.includes(item.sku));
            setTickets(filtered);
        });
        return () => { unsubMov(); unsubAudit(); unsubTickets(); };
    }

    return () => { unsubMov(); unsubAudit(); };
  }, [item.id, item.sku, item.type]);

  const formatDate = (date: any) => {
    if (!date) return '---';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return format(d, 'dd/MM/yyyy HH:mm');
    } catch {
      return '---';
    }
  };

  const isAsset = item.type === 'asset';
  const asset = item as Asset;

  const tabs = [
    { id: 'overview', label: isAsset ? 'Atribuição' : 'Visão Geral', icon: isAsset ? User : Box },
    { id: 'actions', label: isAsset ? 'Manutenção/Tickets' : 'Movimentações', icon: isAsset ? Wrench : ClipboardList },
    { id: 'audit', label: 'Logs & Auditoria', icon: History },
  ];

  return (
    <div className="bg-white flex flex-col h-full rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-8 border-b border-zinc-100 bg-zinc-50/50 relative">
        <div className="flex items-center justify-between mb-6">
          <div className={cn(
            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
            item.status === 'available' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
            item.status === 'low_stock' ? "bg-amber-50 text-amber-600 border-amber-100" :
            "bg-rose-50 text-rose-600 border-rose-100"
          )}>
            {item.status.replace('_', ' ')}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-start gap-6">
          <div className={cn(
            "w-20 h-20 rounded-3xl flex items-center justify-center border shadow-sm",
            isAsset ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-zinc-900 text-white border-zinc-800"
          )}>
            {isAsset ? <Laptop className="w-10 h-10" /> : <Package className="w-10 h-10" />}
          </div>
          <div className="flex-1 min-w-0">
             <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight truncate">{item.name}</h2>
             <div className="mt-2 flex flex-wrap gap-3">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-zinc-100">
                   SKU: {item.sku}
                </span>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-white px-2 py-1 rounded border border-zinc-100 flex items-center gap-1">
                   <MapPin className="w-3 h-3" /> {item.location}
                </span>
             </div>
          </div>
        </div>

        <div className="mt-10 flex space-x-6 border-b border-zinc-100">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 relative",
                activeTab === tab.id ? "text-indigo-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabInv" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-0">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div 
               key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-8 pt-8"
            >
               {isAsset ? (
                 <>
                   <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Atribuição de Patrimônio</h4>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex items-center gap-4">
                         <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                            <User className="w-6 h-6" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Colaborador Alocado</p>
                            <p className="text-lg font-black text-indigo-900">{asset.assignedTo || 'Não Atribuído (No Estoque)'}</p>
                         </div>
                      </div>
                   </section>

                   <section className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                         <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Garantia Vencimento</p>
                         <p className="text-sm font-black text-zinc-900">{formatDate(asset.warrantyExpiration)}</p>
                      </div>
                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                         <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Data Aquisição</p>
                         <p className="text-sm font-black text-zinc-900">{formatDate(asset.acquisitionDate)}</p>
                      </div>
                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 col-span-2">
                         <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Número de Série (S/N)</p>
                         <p className="text-lg font-mono font-bold text-zinc-900">{asset.serialNumber || '---'}</p>
                      </div>
                   </section>
                 </>
               ) : (
                 <>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                         <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Saldo Atual</p>
                         <p className="text-3xl font-black text-zinc-900">{item.quantity} <span className="text-xs uppercase text-zinc-400">un</span></p>
                      </div>
                      <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
                         <p className="text-[10px] font-black text-rose-400 uppercase mb-1">Estoque Mínimo</p>
                         <p className="text-3xl font-black text-rose-900">{item.minQuantity} <span className="text-xs uppercase text-rose-400">un</span></p>
                      </div>
                   </div>

                   <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Parâmetros de Compra</h4>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                            <div className="flex items-center gap-3">
                               <Truck className="w-5 h-5 text-zinc-400" />
                               <span className="text-xs font-black text-zinc-900 uppercase">Fornecedor Padrão</span>
                            </div>
                            <span className="text-xs font-bold text-zinc-600">{item.supplier || 'N/A'}</span>
                         </div>
                         <div className="flex justify-between items-center bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                            <div className="flex items-center gap-3">
                               <DollarSign className="w-5 h-5 text-zinc-400" />
                               <span className="text-xs font-black text-zinc-900 uppercase">Valor Unitário</span>
                            </div>
                            <span className="text-xs font-bold text-zinc-600">{formatCurrency(item.unitPrice)}</span>
                         </div>
                      </div>
                   </section>
                 </>
               )}
            </motion.div>
          )}

          {activeTab === 'actions' && (
            <motion.div 
               key="actions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-6 pt-8"
            >
               {isAsset ? (
                 <div className="space-y-6">
                    {tickets.length > 0 ? (
                      <div className="space-y-3">
                         <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Histórico de Chamados</h4>
                         {tickets.map((t: any) => (
                           <div key={t.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 group hover:border-indigo-200 transition-all">
                              <div className="flex justify-between items-start mb-2">
                                 <p className="text-xs font-black text-zinc-900 uppercase">{t.protocol}</p>
                                 <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                                    t.status === 'open' ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                                 )}>{t.status}</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 font-medium leading-tight">{t.title}</p>
                              <div className="mt-3 flex justify-between items-center">
                                 <span className="text-[9px] text-zinc-400 font-bold">{formatDate(t.createdAt)}</span>
                                 <button className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1 group-hover:gap-2 transition-all">
                                    Ver Detalhes <ExternalLink className="w-3 h-3" />
                                 </button>
                              </div>
                           </div>
                         ))}
                      </div>
                    ) : (
                      <div className="py-20 text-center space-y-4">
                         <Wrench className="w-12 h-12 text-zinc-100 mx-auto" />
                         <p className="text-[10px] font-black text-zinc-400 uppercase">Nenhuma manutenção registrada</p>
                         <button className="text-[10px] font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl">Abrir Novo Chamado de Reparo</button>
                      </div>
                    )}
                 </div>
               ) : (
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Histórico de Movimentação</h4>
                    <div className="space-y-4">
                       {movements.map((mov) => (
                         <div key={mov.id} className="flex gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className={cn(
                               "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                               mov.quantity > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                               {mov.quantity > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <div className="flex-1">
                               <div className="flex justify-between">
                                  <p className="text-[11px] font-black text-zinc-900 uppercase">{mov.reason.replace('_', ' ')}</p>
                                  <span className={cn(
                                     "text-xs font-black",
                                     mov.quantity > 0 ? "text-emerald-600" : "text-rose-600"
                                  )}>{mov.quantity > 0 ? '+' : ''}{mov.quantity}</span>
                               </div>
                               <p className="text-[10px] text-zinc-400 font-bold mt-0.5">{formatDate(mov.timestamp)} • {mov.performedBy}</p>
                            </div>
                         </div>
                       ))}
                       {movements.length === 0 && (
                         <div className="py-20 text-center opacity-30">
                            <ClipboardList className="w-10 h-10 mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase">Sem movimentações recentes</p>
                         </div>
                       )}
                    </div>
                 </div>
               )}
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
               key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-6 pt-8"
            >
               <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Logs do sistema</h4>
               {auditLogs.length > 0 ? (
                 <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
                         <History className="w-4 h-4 text-zinc-400 mt-0.5" />
                         <div>
                            <p className="text-[10px] text-zinc-900 font-black uppercase">
                               {log.userName} • {log.action.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-bold">{formatDate(log.timestamp)}</p>
                         </div>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="py-20 text-center opacity-20">
                    <History className="w-10 h-10 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sem logs disponíveis</p>
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col gap-4">
         {isAsset ? (
           <div className="space-y-3">
              <button 
                onClick={onTransfer}
                className="w-full py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                 <ArrowUpDown className="w-4 h-4" /> Transferir Titularidade
              </button>
              <button className="w-full py-4 bg-white border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-rose-50 transition shadow-sm flex items-center justify-center gap-2">
                 <Trash2 className="w-4 h-4" /> Baixa por Inutilização
              </button>
           </div>
         ) : (
           <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={onMovement}
                className="py-4 bg-white border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-emerald-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                 <ArrowUpRight className="w-4 h-4" /> Entrada
              </button>
              <button 
                onClick={onMovement}
                className="py-4 bg-white border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-rose-50 transition shadow-sm flex items-center justify-center gap-2"
              >
                 <ArrowDownLeft className="w-4 h-4" /> Baixa / Saída
              </button>
           </div>
         )}
         
         <div className="flex items-center justify-between text-[8px] font-black text-zinc-400 uppercase tracking-widest px-2">
            <span>Audit Engine ID: {item.id?.slice(-8) || 'SYSTEM'}</span>
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Seguro</span>
         </div>
      </div>
    </div>
  );
}
