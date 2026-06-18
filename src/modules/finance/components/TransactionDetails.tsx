import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldCheck, Download, ExternalLink, 
  Clock, CheckCircle2, AlertCircle, FileText, 
  MapPin, Landmark, PieChart, History, Eye,
  Check, Ban, DollarSign
} from 'lucide-react';
import { Transaction, AuditLog } from '@/src/types';
import { cn, formatCurrency } from '@/src/lib/utils';
import { format } from 'date-fns';
import { db } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

interface TransactionDetailsProps {
  transaction: Transaction;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onPay?: (id: string) => void;
  userRole?: string;
}

export default function TransactionDetails({ 
  transaction, 
  onClose, 
  onApprove, 
  onReject, 
  onPay,
  userRole 
}: TransactionDetailsProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'receipts' | 'workflow' | 'audit'>('summary');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (!transaction.id) return;
    const q = query(
      collection(db, 'audit'),
      where('resource', '==', 'transactions'),
      where('resourceId', '==', transaction.id),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    return () => unsubscribe();
  }, [transaction.id]);

  const formatDate = (date: any) => {
    if (!date) return '---';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return format(d, 'dd/MM/yyyy HH:mm');
    } catch {
      return '---';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'paid': return { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2, label: 'Pago' };
      case 'approved': return { color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: ShieldCheck, label: 'Aprovado' };
      case 'pending_approval': return { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Clock, label: 'Pendente de Aprovação' };
      case 'cancelled': return { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: Ban, label: 'Cancelado' };
      default: return { color: 'text-zinc-600 bg-zinc-50 border-zinc-100', icon: AlertCircle, label: status };
    }
  };

  const statusConfig = getStatusConfig(transaction.status);

  return (
    <div className="bg-white flex flex-col h-full rounded-[2rem] border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 relative bg-zinc-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
            statusConfig.color
          )}>
            <statusConfig.icon className="w-3.5 h-3.5 mr-1" />
            {statusConfig.label}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 transition-all">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight">
            {transaction.title || transaction.description}
          </h2>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            ID: {transaction.id?.slice(0, 8)}... • {transaction.category}
          </p>
        </div>

        <div className="mt-6 flex space-x-6 border-b border-zinc-100">
          {[
            { id: 'summary', label: 'Resumo', icon: PieChart },
            { id: 'receipts', label: 'Comprovantes', icon: FileText },
            { id: 'workflow', label: 'Workflow', icon: CheckCircle2 },
            { id: 'audit', label: 'Logs', icon: History },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-2 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === tab.id ? "border-b-2 border-indigo-600 text-indigo-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' && (
            <motion.div 
              key="summary" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Valor Total</p>
                  <p className={cn(
                    "text-2xl font-black",
                    transaction.type === 'expense' ? "text-rose-600" : "text-emerald-600"
                  )}>
                    {transaction.type === 'expense' ? '-' : '+'} {formatCurrency(transaction.amount)}
                  </p>
                </div>
                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Data da Transação</p>
                  <p className="text-xl font-black text-zinc-900">{formatDate(transaction.date)}</p>
                </div>
              </div>

              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Rateio & Centro de Custo</h4>
                <div className="flex items-center gap-4 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                      <Landmark className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Centro de Custo</p>
                      <p className="text-sm font-black text-indigo-900">{transaction.costCenter || 'Nenhum atrelado'}</p>
                   </div>
                </div>
              </section>

              <section className="space-y-4">
                 <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Informações de Saída</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-bold">
                       <span className="text-zinc-400 uppercase">Solicitado por</span>
                       <span className="text-zinc-900">{transaction.requestedBy || 'Recorrência Sistema'}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold">
                       <span className="text-zinc-400 uppercase">Forma de Pagamento</span>
                       <span className="text-zinc-900">Boleto Bancário</span>
                    </div>
                 </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'receipts' && (
            <motion.div 
              key="receipts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {transaction.attachmentUrl ? (
                <div className="space-y-4">
                   <div className="aspect-video bg-zinc-100 rounded-3xl border border-zinc-200 overflow-hidden relative group">
                      <img 
                        src={transaction.attachmentUrl} 
                        alt="Comprovante" 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                         <a href={transaction.attachmentUrl} target="_blank" rel="noreferrer" className="p-3 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform shadow-xl">
                            <Eye className="w-5 h-5" />
                         </a>
                         <button className="p-3 bg-white rounded-full text-zinc-900 hover:scale-110 transition-transform shadow-xl">
                            <Download className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                   <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <FileText className="w-5 h-5 text-zinc-400" />
                         <div>
                            <p className="text-xs font-black text-zinc-900 uppercase">NF_EMPRESA_9982.pdf</p>
                            <p className="text-[10px] text-zinc-500 font-bold">1.2 MB • Enviado em {formatDate(transaction.date)}</p>
                         </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-zinc-400" />
                   </div>
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-200">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-zinc-900 uppercase">Nenhum anexo encontrado</p>
                    <p className="text-xs text-zinc-400 font-medium">Esta transação não possui comprovantes registrados.</p>
                  </div>
                  <button className="px-6 py-3 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-all">
                    Anexar Agora
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'workflow' && (
            <motion.div 
               key="workflow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-8"
            >
               <div className="relative pl-8 space-y-12 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                  <div className="relative">
                     <div className="absolute -left-[32px] top-1 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-100 z-10">
                        <Check className="w-3.5 h-3.5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{formatDate(transaction.date)}</p>
                        <p className="text-sm font-black text-zinc-900">Solicitação Criada</p>
                        <p className="text-xs text-zinc-500 font-medium mt-1">Por: {transaction.requestedBy || 'Sistema'}</p>
                     </div>
                  </div>

                  <div className="relative">
                     <div className={cn(
                        "absolute -left-[32px] top-1 w-6 h-6 rounded-full flex items-center justify-center z-10",
                        transaction.status === 'pending_approval' ? "bg-amber-500 text-white animate-pulse" : "bg-emerald-500 text-white"
                     )}>
                        {transaction.status === 'pending_approval' ? <Clock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Aguardando Revisão</p>
                        <p className="text-sm font-black text-zinc-900">Aprovação do Gestor Financeiro</p>
                        {transaction.approvedBy && <p className="text-xs text-zinc-500 font-medium mt-1">Aprovado por: {transaction.approvedBy}</p>}
                     </div>
                  </div>

                  <div className="relative opacity-40">
                     <div className="absolute -left-[32px] top-1 w-6 h-6 bg-zinc-200 text-white rounded-full flex items-center justify-center z-10">
                        <DollarSign className="w-3.5 h-3.5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Aguardando Pagamento</p>
                        <p className="text-sm font-black text-zinc-900">Liquidação Bancária</p>
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
               key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-6"
            >
               {auditLogs.length > 0 ? (
                 <div className="space-y-4">
                    {auditLogs.map((log) => (
                       <div key={log.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
                          <History className="w-4 h-4 text-zinc-400 mt-0.5" />
                          <div>
                             <p className="text-[10px] font-black text-zinc-900 uppercase">
                                {log.userName} • {log.action.replace('_', ' ')}
                             </p>
                             <p className="text-[10px] text-zinc-400 font-bold">{formatDate(log.timestamp)}</p>
                          </div>
                       </div>
                    ))}
                 </div>
               ) : (
                 <div className="py-20 text-center">
                    <History className="w-12 h-12 text-zinc-100 mx-auto mb-3" />
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sem logs de auditoria</p>
                 </div>
               )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-zinc-50 border-t border-zinc-100 space-y-3">
        {transaction.status === 'pending_approval' && (userRole === 'ADMIN' || userRole === 'MANAGER') && (
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => onReject?.(transaction.id!)}
              className="py-4 bg-white border border-rose-200 text-rose-600 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-rose-50 transition shadow-sm"
            >
               Rejeitar
            </button>
            <button 
              onClick={() => onApprove?.(transaction.id!)}
              className="py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-600/20"
            >
               Aprovar
            </button>
          </div>
        )}
        
        {transaction.status === 'approved' && (userRole === 'ADMIN' || userRole === 'MANAGER') && (
           <button 
             onClick={() => onPay?.(transaction.id!)}
             className="w-full py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-700 transition shadow-xl shadow-emerald-600/20"
           >
              Confirmar Pagamento (LIQUIDAR)
           </button>
        )}

        <button className="w-full py-3 text-zinc-400 font-black uppercase tracking-widest text-[9px] hover:text-zinc-600 transition">
           Download Relatório Auditoria (PDF)
        </button>
      </div>
    </div>
  );
}
