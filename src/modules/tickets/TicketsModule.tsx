import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy, getDoc } from 'firebase/firestore';
import { Ticket, TicketStatus, TicketPriority, TicketCategory, UserProfile } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { 
  LifeBuoy, Search, Plus, Filter, Clock, User, 
  CheckCircle2, AlertCircle, MessageSquare, 
  MoreVertical, X, Shield, ArrowRight, Tag, Hash, Download,
  LayoutList, LayoutDashboard, Columns, Monitor, Settings,
  Calendar, Zap, TrendingUp, BarChart3, ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import { cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import TicketWorkspace from './components/TicketWorkspace';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

type ViewMode = 'list' | 'kanban';

export default function TicketsModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'IT' as TicketCategory,
    priority: 'medium' as TicketPriority
  });

  const statuses: TicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

  useEffect(() => {
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
      
      // Keep selected ticket in sync if open
      if (selectedTicket) {
        const updated = docs.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    });
    return () => unsubscribe();
  }, [selectedTicket?.id]);

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
    t.protocol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.requesterName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const analyticsData = {
    byCategory: [
      { name: 'Hardware', value: tickets.filter(t => t.category === 'IT').length },
      { name: 'Sistemas', value: tickets.filter(t => t.category === 'System').length },
      { name: 'Manutenção', value: tickets.filter(t => t.category === 'Maintenance').length },
      { name: 'RH', value: tickets.filter(t => t.category === 'HR').length },
    ],
    volumeDaily: [
      { day: 'Seg', volume: 12 },
      { day: 'Ter', volume: 19 },
      { day: 'Qua', volume: 15 },
      { day: 'Qui', volume: 22 },
      { day: 'Sex', volume: 30 },
      { day: 'Sab', volume: 8 },
      { day: 'Dom', volume: 5 },
    ]
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header Central de Operações */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <LifeBuoy className="w-8 h-8 text-indigo-600" />
            ServiceDesk Enterprise
          </h2>
          <p className="text-zinc-500 text-sm font-medium">Mesa de Operações Integrada • SLA 99.9%</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('kanban')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'kanban' ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setShowAnalytics(!showAnalytics)}
            className={cn(
              "p-2.5 rounded-xl border transition-all",
              showAnalytics ? "bg-indigo-600 text-white border-indigo-500 shadow-lg" : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            )}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-xl active:scale-95"
          >
            <Plus className="w-4 h-4" />
             Novo Chamado
          </button>
        </div>
      </div>

      {/* Analytics Dashboard (Collapsible) */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-zinc-50 p-6 rounded-3xl border border-zinc-200">
               <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Volume por Categoria</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyticsData.byCategory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-white p-6 rounded-2xl border border-zinc-100 shadow-sm">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-6">Demanda Semanal</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.volumeDaily}>
                        <defs>
                          <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#A1A1AA' }} />
                        <Area type="monotone" dataKey="volume" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-zinc-900 p-6 rounded-2xl shadow-xl shadow-zinc-900/10 text-white flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">MTTR (Média de Resolução)</h4>
                    <div className="text-4xl font-black flex items-baseline gap-2">
                       3.4 <span className="text-sm text-zinc-500">Horas</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between text-[10px] font-black uppercase">
                        <span className="text-zinc-500">Saúde do SLA</span>
                        <span className="text-emerald-400">Excelente (98.2%)</span>
                     </div>
                     <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[98.2%]" />
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Protocolo, Solicitante ou Título do Chamado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {/* Main Workspace: Split Master-Detail */}
      <div className={cn(
        "flex-1 flex gap-6 min-h-0",
        selectedTicket ? "grid grid-cols-1 xl:grid-cols-2" : "grid grid-cols-1"
      )}>
        {/* Left Side: Work Queue */}
        <div className="flex flex-col gap-4 overflow-hidden h-full">
           {viewMode === 'list' ? (
             <div className="space-y-4 overflow-y-auto pr-2 pb-20 custom-scrollbar">
                {filteredTickets.map((ticket, idx) => (
                  <motion.div 
                    layoutId={`ticket-${ticket.id}`}
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={cn(
                      "bg-white border p-5 rounded-3xl transition-all cursor-pointer group shadow-sm",
                      selectedTicket?.id === ticket.id ? "border-indigo-600 ring-4 ring-indigo-500/5 bg-zinc-50/30" : "border-zinc-200 hover:border-indigo-200"
                    )}
                  >
                     <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                           <div className={cn(
                             "w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                             getStatusStyle(ticket.status)
                           )}>
                              {ticket.status === 'resolved' || ticket.status === 'closed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                           </div>
                           <div>
                              <div className="flex items-center gap-2 mb-2">
                                 <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded tracking-widest uppercase border border-indigo-100">
                                    {ticket.protocol}
                                 </span>
                                 <span className={cn(
                                   "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border",
                                   ticket.priority === 'critical' ? "bg-red-50 text-red-600 border-red-100" :
                                   ticket.priority === 'high' ? "bg-orange-50 text-orange-600 border-orange-100" :
                                   "bg-zinc-50 text-zinc-500 border-zinc-100"
                                 )}>
                                    {ticket.priority}
                                 </span>
                              </div>
                              <h3 className="font-black text-zinc-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight leading-tight">
                                {ticket.title}
                              </h3>
                              <div className="flex items-center gap-4 mt-4">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-tight bg-zinc-50 px-2 py-1 rounded-lg">
                                  <User className="w-3 h-3" /> {ticket.requesterName}
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-zinc-400 uppercase tracking-tight bg-zinc-50 px-2 py-1 rounded-lg">
                                  <Tag className="w-3 h-3" /> {ticket.category}
                                </div>
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-right">
                           {/* SLA Indicator */}
                           <div className="flex items-center gap-2 mb-2">
                              <span className="text-[8px] font-black text-zinc-400 uppercase">SLA Saúde</span>
                              <div className="w-16 h-1 rounded-full bg-zinc-100 overflow-hidden">
                                 <div className="bg-emerald-500 h-full w-[80%]" />
                              </div>
                           </div>
                           <ChevronRight className={cn(
                             "w-5 h-5 text-zinc-300 transition-all",
                             selectedTicket?.id === ticket.id ? "translate-x-1 text-indigo-600" : "group-hover:translate-x-1"
                           )} />
                        </div>
                     </div>
                  </motion.div>
                ))}
             </div>
           ) : (
             <div className="flex gap-6 overflow-x-auto pb-4 h-full custom-scrollbar">
                {statuses.map(status => (
                  <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
                     <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          {status.replace('_', ' ')}
                        </h4>
                        <span className="bg-zinc-100 text-zinc-500 px-2 py-1 rounded-lg text-[10px] font-bold">
                           {tickets.filter(t => t.status === status).length}
                        </span>
                     </div>
                     <div className="flex-1 bg-zinc-50/50 rounded-3xl border border-dashed border-zinc-200 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-400px)]">
                        {tickets.filter(t => t.status === status).map(ticket => (
                           <motion.div 
                             layoutId={`ticket-${ticket.id}`}
                             key={ticket.id}
                             onClick={() => setSelectedTicket(ticket)}
                             className={cn(
                               "bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-sm hover:border-indigo-200 group ring-indigo-500/5 hover:ring-4",
                               selectedTicket?.id === ticket.id ? "border-indigo-600" : "border-zinc-200"
                             )}
                           >
                              <span className={cn(
                                "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border inline-block mb-2",
                                ticket.priority === 'critical' ? "bg-red-50 text-red-600 border-red-100" : "bg-zinc-50 text-zinc-500 border-zinc-100"
                              )}>
                                 {ticket.priority}
                              </span>
                              <h5 className="text-[11px] font-black text-zinc-900 group-hover:text-indigo-600 transition-all uppercase leading-tight line-clamp-2">{ticket.title}</h5>
                              <div className="mt-4 flex items-center justify-between">
                                 <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-400 uppercase">
                                    <User className="w-2.5 h-2.5" /> {ticket.requesterName.split(' ')[0]}
                                 </div>
                                 <div className="flex items-center gap-1.5 text-[8px] font-black text-zinc-300 uppercase">
                                    <Clock className="w-2.5 h-2.5" /> 2h
                                 </div>
                              </div>
                           </motion.div>
                        ))}
                     </div>
                  </div>
                ))}
             </div>
           )}
        </div>

        {/* Right Side: Ticket Workspace (Detail) */}
        <AnimatePresence>
          {selectedTicket && (
            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 20, opacity: 0 }}
              className="hidden xl:block h-full overflow-hidden"
            >
               <TicketWorkspace 
                 ticket={selectedTicket} 
                 onClose={() => setSelectedTicket(null)}
                 userProfile={userProfile}
               />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Detail Overlay */}
        <AnimatePresence>
          {selectedTicket && (
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="xl:hidden fixed inset-0 z-[60] bg-white p-4 pt-12 overflow-hidden"
            >
               <TicketWorkspace 
                 ticket={selectedTicket} 
                 onClose={() => setSelectedTicket(null)}
                 userProfile={userProfile}
               />
            </motion.div>
          )}
        </AnimatePresence>
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
