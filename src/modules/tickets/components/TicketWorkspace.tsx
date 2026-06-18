import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, MessageSquare, Link2, History, Send, 
  Lock, Globe, User, Package, DollarSign, 
  Clock, ShieldCheck, CheckCircle2, AlertCircle,
  FileText, ExternalLink, UserPlus, Zap
} from 'lucide-react';
import { Ticket, TicketInteraction, AuditLog, InventoryItem, Transaction } from '@/src/types';
import { cn, formatCurrency } from '@/src/lib/utils';
import { db, auth } from '@/src/lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, updateDoc, doc, limit 
} from 'firebase/firestore';
import { format, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

interface TicketWorkspaceProps {
  ticket: Ticket;
  onClose: () => void;
  userProfile?: any;
}

export default function TicketWorkspace({ ticket, onClose, userProfile }: TicketWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'links' | 'audit'>('chat');
  const [interactions, setInteractions] = useState<TicketInteraction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [assets, setAssets] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticket.id) return;

    // Interactions
    const qInt = query(
      collection(db, 'interactions'),
      where('ticketId', '==', ticket.id),
      orderBy('timestamp', 'asc')
    );
    const unsubInt = onSnapshot(qInt, (snap) => {
      setInteractions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TicketInteraction)));
    });

    // Audit Logs
    const qAudit = query(
      collection(db, 'auditLogs'),
      where('resource', '==', 'tickets'),
      where('resourceId', '==', ticket.id),
      orderBy('timestamp', 'desc')
    );
    const unsubAudit = onSnapshot(qAudit, (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    // Potential Links (Initial Fetch)
    const qAssets = query(collection(db, 'inventory'), limit(10));
    const unsubAssets = onSnapshot(qAssets, (snap) => {
      setAssets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    const qTrans = query(collection(db, 'transactions'), limit(10));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    return () => { unsubInt(); unsubAudit(); unsubAssets(); unsubTrans(); };
  }, [ticket.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interactions]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !ticket.id) return;

    try {
      const user = auth.currentUser;
      const interaction: any = {
        ticketId: ticket.id,
        senderId: user?.uid || 'system',
        senderName: userProfile?.displayName || user?.email || 'User',
        text: message,
        timestamp: serverTimestamp(),
        type: isInternal ? 'internal' : 'public'
      };

      await addDoc(collection(db, 'interactions'), interaction);
      await updateDoc(doc(db, 'tickets', ticket.id), { updatedAt: serverTimestamp() });
      
      setMessage('');
      toast.success(isInternal ? 'Nota interna adicionada' : 'Mensagem enviada');
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleLinkAsset = async (asset: InventoryItem) => {
    if (!ticket.id) return;
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        linkedAssetId: asset.id,
        linkedAssetName: asset.name,
        updatedAt: serverTimestamp()
      });
      toast.success(`Ticket vinculado ao ativo ${asset.name}`);
    } catch (error) {
      toast.error('Erro ao vincular ativo');
    }
  };

  const handleLinkTransaction = async (tx: Transaction) => {
    if (!ticket.id) return;
    try {
      await updateDoc(doc(db, 'tickets', ticket.id), {
        linkedTransactionId: tx.id,
        linkedTransactionAmount: tx.amount,
        updatedAt: serverTimestamp()
      });
      toast.success(`Ticket vinculado à transação R$ ${tx.amount}`);
    } catch (error) {
      toast.error('Erro ao vincular financeiro');
    }
  };

  const calculateSLAStatus = () => {
    if (!ticket.createdAt) return '---';
    const start = ticket.createdAt instanceof Date ? ticket.createdAt : (ticket.createdAt.toDate ? ticket.createdAt.toDate() : new Date(ticket.createdAt));
    const hoursElapsed = differenceInHours(new Date(), start);
    
    if (ticket.status === 'resolved' || ticket.status === 'closed') return 'Concluído';
    
    if (hoursElapsed > 48) return 'Atrasado';
    if (hoursElapsed > 24) return 'Atenção';
    return 'Dentro do Prazo';
  };

  const tabs = [
    { id: 'chat', label: 'Interações & Chat', icon: MessageSquare },
    { id: 'links', label: 'Vínculos Operacionais', icon: Link2 },
    { id: 'audit', label: 'Auditoria & SLA', icon: History },
  ];

  return (
    <div className="bg-white flex flex-col h-full rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded tracking-widest uppercase border border-indigo-100">
               {ticket.protocol}
            </span>
            <div className={cn(
              "px-2 py-1 rounded-[6px] text-[8px] font-black uppercase tracking-widest border",
              ticket.status === 'open' ? "bg-blue-50 text-blue-600 border-blue-100" :
              ticket.status === 'in_progress' ? "bg-amber-50 text-amber-600 border-amber-100" :
              ticket.status === 'resolved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
              "bg-zinc-100 text-zinc-500 border-zinc-200"
            )}>
              {ticket.status.replace('_', ' ')}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-400 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="text-xl font-black text-zinc-900 tracking-tight leading-tight mb-2">{ticket.title}</h2>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
              <User className="w-3 h-3" /> {ticket.requesterName}
           </div>
           <div className="flex items-center gap-1 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
              <Clock className="w-3 h-3" /> SLA: {calculateSLAStatus()}
           </div>
        </div>

        <div className="mt-8 flex space-x-6 border-b border-zinc-100">
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
                <motion.div layoutId="activeTabTicket" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-white relative">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div 
               key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="flex flex-col h-full bg-zinc-50/30 rounded-3xl overflow-hidden"
            >
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
                     <p className="text-[10px] font-black tracking-widest uppercase text-zinc-400 mb-2">Relato Inicial</p>
                     <p className="text-sm font-medium text-zinc-600 leading-relaxed">{ticket.description}</p>
                  </div>
                  
                  {interactions.map((int) => (
                    <div 
                      key={int.id}
                      className={cn(
                        "flex flex-col max-w-[85%] space-y-1",
                        int.senderId === auth.currentUser?.uid ? "ml-auto items-end" : "items-start"
                      )}
                    >
                       <div className={cn(
                         "p-4 rounded-2xl text-sm shadow-sm border",
                         int.type === 'internal' ? "bg-amber-50 border-amber-200 text-amber-900" : 
                         int.senderId === auth.currentUser?.uid ? "bg-zinc-900 text-white border-zinc-800" : 
                         "bg-white text-zinc-700 border-zinc-100"
                       )}>
                          {int.type === 'internal' && <div className="flex items-center gap-1 text-[8px] font-black uppercase mb-1 opacity-60"><Lock className="w-2.5 h-2.5" /> Nota Interna</div>}
                          <p className="font-medium leading-relaxed">{int.text}</p>
                       </div>
                       <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest px-2">
                          {int.senderName} • {int.timestamp ? format(int.timestamp.toDate(), 'HH:mm') : 'Agora'}
                       </span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
               </div>

               <div className="p-4 bg-white border-t border-zinc-100 space-y-3">
                  <div className="flex items-center gap-4">
                     <button 
                        onClick={() => setIsInternal(false)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                          !isInternal ? "bg-zinc-900 text-white shadow-lg" : "bg-zinc-100 text-zinc-400"
                        )}
                     >
                        <Globe className="w-3 h-3" /> Resposta Pública
                     </button>
                     <button 
                        onClick={() => setIsInternal(true)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                          isInternal ? "bg-amber-100 text-amber-700 shadow-lg border border-amber-200" : "bg-zinc-100 text-zinc-400"
                        )}
                     >
                        <Lock className="w-3 h-3" /> Nota Interna (Staff)
                     </button>
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                     <input 
                        value={message} onChange={e => setMessage(e.target.value)}
                        placeholder={isInternal ? "Escreva uma observação interna..." : "Digite sua mensagem para o solicitante..."}
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                     />
                     <button type="submit" className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all shrink-0">
                        <Send className="w-5 h-5" />
                     </button>
                  </form>
               </div>
            </motion.div>
          )}

          {activeTab === 'links' && (
            <motion.div 
               key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="space-y-8 h-full"
            >
               <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Recursos Vinculados</h4>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                           <Package className="w-4 h-4 text-amber-600" />
                           <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Ativo/Patrimônio</span>
                        </div>
                        <p className="text-xs font-black text-amber-900 group">{ticket.linkedAssetName || 'Não vinculado'}</p>
                     </div>
                     <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center gap-2 mb-2">
                           <DollarSign className="w-4 h-4 text-emerald-600" />
                           <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Financeiro/Custos</span>
                        </div>
                        <p className="text-xs font-black text-emerald-900">{ticket.linkedTransactionAmount ? formatCurrency(ticket.linkedTransactionAmount) : 'Não vinculado'}</p>
                     </div>
                  </div>
               </section>

               <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Vincular Novo Recurso</h4>
                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Itens de Estoque Recentes</p>
                     {assets.map(asset => (
                        <button 
                          key={asset.id}
                          onClick={() => handleLinkAsset(asset)}
                          className="w-full flex items-center justify-between p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-indigo-200 transition-all text-left"
                        >
                           <div className="flex items-center gap-3">
                              <Package className="w-4 h-4 text-zinc-400" />
                              <div className="text-xs font-bold text-zinc-900">{asset.name} <span className="text-[9px] text-zinc-400 ml-1">({asset.sku})</span></div>
                           </div>
                           <Zap className="w-3 h-3 text-zinc-300" />
                        </button>
                     ))}
                  </div>
                  <div className="space-y-3">
                     <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Transações Financeiras Recentes</p>
                     {transactions.map(tx => (
                        <button 
                          key={tx.id}
                          onClick={() => handleLinkTransaction(tx)}
                          className="w-full flex items-center justify-between p-3 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-indigo-200 transition-all text-left"
                        >
                           <div className="flex items-center gap-3">
                              <DollarSign className="w-4 h-4 text-zinc-400" />
                              <div className="text-xs font-bold text-zinc-900 uppercase">{tx.description} <span className="text-[9px] text-zinc-400 ml-1">({formatCurrency(tx.amount)})</span></div>
                           </div>
                           <Zap className="w-3 h-3 text-zinc-300" />
                        </button>
                     ))}
                  </div>
               </section>
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
               key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="space-y-6 h-full"
            >
               <section className="bg-zinc-900 rounded-3xl p-6 text-white overflow-hidden relative">
                  <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/5 rounded-full blur-xl" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-4">Medição de SLA de Atendimento</p>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                     <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                        <p className="text-[8px] font-black text-white/60 mb-1 uppercase">SLA Status</p>
                        <p className="text-sm font-black uppercase">{calculateSLAStatus()}</p>
                     </div>
                     <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                        <p className="text-[8px] font-black text-white/60 mb-1 uppercase">Aberto em</p>
                        <p className="text-sm font-black uppercase">
                           {ticket.createdAt?.toDate ? format(ticket.createdAt.toDate(), 'dd/MM HH:mm') : '---'}
                        </p>
                     </div>
                  </div>
               </section>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Ledger de Auditoria Imutável</h4>
                  <div className="space-y-3">
                     {auditLogs.map(log => (
                        <div key={log.id} className="flex gap-3 p-3 bg-zinc-50 border border-zinc-100 rounded-xl items-start">
                           <History className="w-4 h-4 text-zinc-300 mt-1 shrink-0" />
                           <div>
                              <p className="text-[10px] font-black text-zinc-900 uppercase">{log.userName} • {log.action.replace('_', ' ')}</p>
                              <p className="text-[9px] text-zinc-400 font-bold">{log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yy HH:mm:ss') : '---'}</p>
                              {log.changes && (
                                <p className="text-[9px] text-indigo-600 font-bold mt-1 uppercase">Mudança detectada no sistema</p>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Actions Header */}
      <div className="p-6 bg-zinc-900 border-t border-zinc-800 flex flex-col gap-4">
         <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={async () => {
                if (!ticket.id) return;
                const user = auth.currentUser;
                await updateDoc(doc(db, 'tickets', ticket.id), {
                   assigneeId: user?.uid,
                   assigneeName: userProfile?.displayName,
                   status: 'in_progress',
                   updatedAt: serverTimestamp()
                });
                toast.success('Você assumiu este chamado');
              }}
              className="py-3 bg-white text-zinc-900 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-100 transition shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
               <UserPlus className="w-4 h-4" /> Assumir Ticket
            </button>
            <button 
              onClick={async () => {
                if (!ticket.id) return;
                await updateDoc(doc(db, 'tickets', ticket.id), {
                   status: 'resolved',
                   closedAt: serverTimestamp(),
                   updatedAt: serverTimestamp()
                });
                toast.success('Chamado resolvido com sucesso');
              }}
              className="py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-emerald-700 transition shadow-xl shadow-emerald-900/20 active:scale-95 flex items-center justify-center gap-2"
            >
               <CheckCircle2 className="w-4 h-4" /> Finalizar SLA
            </button>
         </div>
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-400 uppercase tracking-widest">
               <ShieldCheck className="w-3.5 h-3.5" /> Transação Auditada (AuditEngine V2)
            </div>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">V01.Enterprise</p>
         </div>
      </div>
    </div>
  );
}
