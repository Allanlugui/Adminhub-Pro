import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { Ticket, TicketStatus, TicketPriority, TicketCategory, UserProfile } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { 
  LifeBuoy, Search, Plus, Filter, Clock, User, 
  CheckCircle2, AlertCircle, MessageSquare, 
  MoreVertical, X, Shield, ArrowRight, Tag, Hash, Download
} from 'lucide-react';
import { cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function TicketsModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'IT' as TicketCategory,
    priority: 'medium' as TicketPriority
  });

  useEffect(() => {
    // RBAC: Fetch User Profile
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserProfile(docSnap.data() as UserProfile);
      }
    };
    fetchProfile();

    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as Ticket));
      setTickets(docs);
    });
    return () => unsubscribe();
  }, []);

  const generateProtocol = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TCK-${year}-${random}`;
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      const protocol = generateProtocol();
      const ticketData = {
        ...formData,
        protocol,
        status: 'open' as TicketStatus,
        requesterId: user?.uid || 'anonymous',
        requesterName: userProfile?.displayName || user?.email || 'User',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'tickets'), ticketData);
      await logAudit('create', 'tickets', docRef.id, { after: ticketData });

      // Notification for operators/admins
      await pushNotification({
        role: 'ADMIN',
        title: 'Novo Ticket Aberto',
        message: `Chamado ${protocol}: "${ticketData.title}" foi aberto por ${ticketData.requesterName}.`,
        type: 'ticket',
        link: 'tickets'
      });

      toast.success(`Ticket ${protocol} aberto com sucesso!`);
      setIsModalOpen(false);
      setFormData({ title: '', description: '', category: 'IT', priority: 'medium' });
    } catch (error) {
      toast.error('Erro ao abrir ticket.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: TicketStatus) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    try {
      const updateData: any = { 
        status: newStatus, 
        updatedAt: serverTimestamp() 
      };
      
      if (newStatus === 'closed' || newStatus === 'resolved') {
        updateData.closedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'tickets', id), updateData);
      await logAudit('status_change', 'tickets', id, { 
        before: { status: ticket.status }, 
        after: { status: newStatus } 
      });

      // Notification for requester
      await pushNotification({
        userId: ticket.requesterId,
        title: 'Status do Ticket Alterado',
        message: `Seu chamado ${ticket.protocol} agora está como "${newStatus.replace('_', ' ')}".`,
        type: 'ticket',
        link: 'tickets'
      });

      toast.info(`Ticket ${ticket.protocol} atualizado para ${newStatus}.`);
    } catch (error) {
      toast.error('Erro ao atualizar ticket.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = convertToCSV(tickets);
      downloadCSV(csv, `tickets_report_${new Date().toISOString().split('T')[0]}.csv`);
      await logAudit('update', 'tickets', 'bulk_export', { after: { action: 'CSV Export' } });
      toast.success('Lista de tickets exportada.');
    } catch (error) {
      toast.error('Erro na exportação.');
    }
  };

  const getStatusStyle = (status: TicketStatus) => {
    switch (status) {
      case 'open': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'in_progress': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'waiting': return 'bg-purple-50 text-purple-600 border-purple-100';
      case 'resolved': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'closed': return 'bg-zinc-100 text-zinc-500 border-zinc-200';
      default: return 'bg-zinc-50 text-zinc-500 border-zinc-100';
    }
  };

  const getPriorityStyle = (priority: TicketPriority) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-blue-600';
      default: return 'text-zinc-400';
    }
  };

  const filteredTickets = tickets.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.protocol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-7 h-7 text-indigo-600" />
            Central de Serviços (Tickets)
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Gestão de chamados e SLAs corporativos.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center space-x-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-sm"
          >
            <Download className="w-4 h-4" />
            <span className="font-bold">Exportar CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Abrir Chamado
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por protocolo, título ou solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 space-y-4">
          {filteredTickets.map((ticket, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={ticket.id}
              className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-indigo-200 transition-all group shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center border shrink-0",
                    getStatusStyle(ticket.status)
                  )}>
                    {ticket.status === 'resolved' || ticket.status === 'closed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded tracking-widest uppercase">
                        {ticket.protocol}
                      </span>
                      <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", getStatusStyle(ticket.status))}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                    </div>
                    <h3 className="font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                      {ticket.title}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-1 mt-1">{ticket.description}</p>
                    
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 uppercase tracking-tight">
                        <Tag className="w-3 h-3" /> {ticket.category}
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tight", getPriorityStyle(ticket.priority))}>
                        <AlertCircle className="w-3 h-3" /> Prioridade {ticket.priority}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-zinc-400 uppercase tracking-tight">
                        <User className="w-3 h-3" /> {ticket.requesterName}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-1">
                    {ticket.status === 'open' && (
                      <button 
                        onClick={() => handleUpdateStatus(ticket.id!, 'in_progress')}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all"
                      >
                        Atender
                      </button>
                    )}
                    {(ticket.status === 'in_progress' || ticket.status === 'waiting') && (
                      <button 
                        onClick={() => handleUpdateStatus(ticket.id!, 'resolved')}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all"
                      >
                        Resolver
                      </button>
                    )}
                    {ticket.status === 'resolved' && (
                      <button 
                        onClick={() => handleUpdateStatus(ticket.id!, 'closed')}
                        className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 transition-all"
                      >
                        Fechar
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {ticket.createdAt.toLocaleDateString('pt-BR')} {ticket.createdAt.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredTickets.length === 0 && (
            <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-3xl p-20 flex flex-col items-center justify-center text-center">
              <LifeBuoy className="w-12 h-12 text-zinc-300 mb-4" />
              <h3 className="font-bold text-zinc-900">Nenhum ticket encontrado</h3>
              <p className="text-sm text-zinc-500 mt-1">Busque por outros termos ou abra um novo chamado.</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900 rounded-3xl p-6 text-white shadow-xl shadow-zinc-900/20">
            <h3 className="font-black uppercase tracking-widest text-xs mb-4 text-zinc-400">Visão Geral (SLA)</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Abertos</span>
                <span className="text-xl font-black">{tickets.filter(t => t.status === 'open').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Em Atendimento</span>
                <span className="text-xl font-black text-amber-400">{tickets.filter(t => t.status === 'in_progress').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">Resolvidos</span>
                <span className="text-xl font-black text-emerald-400">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</span>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <button className="w-full text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-2">
                Relatórios Completos <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
            <h3 className="font-black uppercase tracking-widest text-xs mb-4 text-zinc-400">Setores Ativos</h3>
            <div className="space-y-3">
              {['IT', 'Maintenance', 'HR', 'Purchasing', 'System'].map(cat => (
                <div key={cat} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    <span className="text-sm font-bold text-zinc-700 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{cat === 'System' ? 'Suporte / Bug' : cat}</span>
                  </div>
                  <span className="text-xs font-black text-zinc-400">{tickets.filter(t => t.category === cat).length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Novo Ticket */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white rotate-3">
                    <LifeBuoy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900">Abertura de Chamado</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Central de Serviços Internos</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateTicket} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Título do Chamado</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Ex: Problema com o Wi-Fi no 2º andar" />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Detalhamento</label>
                  <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" placeholder="Descreva o problema ou solicitação com o máximo de detalhes..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Categoria</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as TicketCategory})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none">
                      <option value="IT">TI / Tecnologia</option>
                      <option value="Maintenance">Manutenção</option>
                      <option value="HR">RH / Administrativo</option>
                      <option value="Purchasing">Suprimentos / Compras</option>
                      <option value="System">Suporte ao Sistema / Bug</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Gravidade / SLA</label>
                    <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as TicketPriority})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none">
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica (Interrupção)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 border border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-all">Cancelar</button>
                  <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 text-xs">Abrir Chamado</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
