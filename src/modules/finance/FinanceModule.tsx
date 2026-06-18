import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Transaction, TransactionStatus, UserProfile } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { 
  DollarSign, ArrowUpRight, ArrowDownLeft, Filter, Plus, Calendar, Tag, X, Check, 
  ShieldAlert, FileText, Repeat, Upload, Paperclip, ExternalLink, Loader2, Download,
  ChevronRight, TrendingUp, Clock, CheckCircle2, BarChart3, PieChart, Search
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area 
} from 'recharts';
import TransactionDetails from './components/TransactionDetails';
import { formatCurrency, cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function FinanceModule() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending_approval' | 'approved' | 'paid'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    amount: 0,
    type: 'expense' as const,
    category: 'Geral',
    costCenter: 'Administrativo',
    isRecurring: false
  });

  useEffect(() => {
    // RBAC: Fetch User Profile
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      }
    };
    fetchProfile();

    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      } as Transaction));
      
      setTransactions(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const storageRef = ref(storage, `finance/receipts/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);
      toast.success('Comprovante enviado com sucesso.');
      return url;
    } catch (error) {
      console.error("Storage Error:", error);
      toast.error('Falha no upload do arquivo.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      const initialStatus: TransactionStatus = userProfile?.role === 'OPERATOR' ? 'pending_approval' : 'approved';
      
      let attachmentUrl = '';
      if (selectedFile) {
        const uploadedUrl = await handleFileUpload(selectedFile);
        if (uploadedUrl) attachmentUrl = uploadedUrl;
      }

      const transactionData = {
        ...formData,
        status: initialStatus,
        attachmentUrl,
        requestedBy: userProfile?.displayName || user?.email || 'System',
        date: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'transactions'), transactionData);
      await logAudit('create', 'transactions', docRef.id, { after: transactionData });
      if (attachmentUrl) {
        await logAudit('upload', 'transactions', docRef.id, { after: { attachmentUrl } });
      }

      if (initialStatus === 'pending_approval') {
        await pushNotification({
          role: 'ADMIN',
          title: 'Aprovação Financeira Requerida',
          message: `${transactionData.requestedBy} solicitou aprovação para "${transactionData.title}" no valor de ${formatCurrency(transactionData.amount)}`,
          type: 'finance',
          link: 'finance'
        });
      }

      toast.success(initialStatus === 'approved' ? 'Transação aprovada e registrada!' : 'Solicitação enviada para aprovação.');
      setIsModalOpen(false);
      setSelectedFile(null);
      setFormData({ title: '', amount: 0, type: 'expense', category: 'Geral', costCenter: 'Administrativo', isRecurring: false });
    } catch (error) {
      console.error("Erro ao adicionar:", error);
      toast.error('Erro ao processar transação.');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: TransactionStatus) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    if ((userProfile?.role === 'OPERATOR') && (newStatus === 'approved' || newStatus === 'paid')) {
      toast.error('Privilégios insuficientes para aprovação.');
      return;
    }

    try {
      const updateData: any = { 
        status: newStatus,
        approvedBy: userProfile?.displayName || 'System'
      };
      if (newStatus === 'paid') updateData.paidAt = serverTimestamp();
      
      await updateDoc(doc(db, 'transactions', id), updateData);
      
      await logAudit('status_change', 'transactions', id, { 
        before: { status: transaction.status }, 
        after: { status: newStatus } 
      });
      
      toast.info(`Status atualizado para: ${newStatus.toUpperCase()}`);
      
      if (selectedTransaction?.id === id) {
        setSelectedTransaction(prev => prev ? { ...prev, ...updateData } : null);
      }

      if (newStatus === 'approved' || newStatus === 'paid') {
        await pushNotification({
          title: 'Transação Atualizada',
          message: `Sua solicitação "${transaction.title}" foi ${newStatus === 'approved' ? 'aprovada' : 'liquidada'}.`,
          type: 'finance',
          link: 'finance'
        });
      }
    } catch (error) {
      toast.error('Falha na atualização do fluxo.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const csv = convertToCSV(transactions);
      downloadCSV(csv, `finance_report_${new Date().toISOString().split('T')[0]}.csv`);
      await logAudit('update', 'transactions', 'bulk_export', { after: { action: 'CSV Export' } });
      toast.success('Relatório exportado com sucesso.');
    } catch (error) {
      toast.error('Erro ao exportar relatório.');
    }
  };

  const dashboardStats = {
    income: transactions.filter(t => t.type === 'income' && (t.status === 'approved' || t.status === 'paid')).reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    expense: transactions.filter(t => t.type === 'expense' && (t.status === 'approved' || t.status === 'paid')).reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
    pending: transactions.filter(t => t.status === 'pending_approval').length,
    pendingAmount: transactions.filter(t => t.status === 'pending_approval').reduce((acc, t) => acc + (Number(t.amount) || 0), 0),
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = (tx.title || tx.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tx.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'all' || tx.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const chartData = [
    { name: 'Seg', receita: 4000, despesa: 2400 },
    { name: 'Ter', receita: 3000, despesa: 1398 },
    { name: 'Qua', receita: 2000, despesa: 9800 },
    { name: 'Qui', receita: 2780, despesa: 3908 },
    { name: 'Sex', receita: 1890, despesa: 4800 },
    { name: 'Sáb', receita: 2390, despesa: 3800 },
    { name: 'Dom', receita: 3490, despesa: 4300 },
  ];

  return (
    <div className="space-y-8 pb-12 h-screen flex flex-col">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
             <DollarSign className="w-8 h-8 text-indigo-600" />
             Gestão Financeira Enterprise
          </h1>
          <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em]">Fluxo de Caixa • Auditoria • Aprovações Multinível</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportCSV}
            className="bg-zinc-100 text-zinc-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Exportar Dados
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Nova Solicitação
          </button>
        </div>
      </div>

      {/* Analytics Dashboard Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-shrink-0">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-zinc-200 shadow-sm flex flex-col md:flex-row gap-8 items-center">
           <div className="space-y-6 w-full md:w-1/3">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                 <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                    <ArrowUpRight className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Receita Acumulada</p>
                    <p className="text-lg font-black text-emerald-900">{formatCurrency(dashboardStats.income)}</p>
                 </div>
              </div>
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center gap-4">
                 <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white">
                    <ArrowDownLeft className="w-5 h-5" />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Despesa Acumulada</p>
                    <p className="text-lg font-black text-rose-900">{formatCurrency(dashboardStats.expense)}</p>
                 </div>
              </div>
           </div>
           
           <div className="flex-1 h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData}>
                    <defs>
                       <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                       </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="receita" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                    <Area type="monotone" dataKey="despesa" stroke="#f43f5e" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                 </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl shadow-zinc-900/20">
           <TrendingUp className="absolute top-[-20%] right-[-10%] w-64 h-64 text-white/5 rotate-12" />
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Pendente de Alçada</p>
              <h3 className="text-4xl font-black">{formatCurrency(dashboardStats.pendingAmount)}</h3>
              <p className="text-[10px] font-bold text-white/60 mt-1 uppercase tracking-widest">{dashboardStats.pending} solicitações aguardando</p>
           </div>
           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between relative z-10 border border-white/10">
              <div className="flex items-center gap-3">
                 <Clock className="w-5 h-5 text-amber-400" />
                 <span className="text-xs font-bold uppercase tracking-widest">Auditoria em Tempo Real</span>
              </div>
              <ChevronRight className="w-5 h-5 opacity-40" />
           </div>
        </div>
      </div>

      {/* Main Workspace: Master-Detail Split */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Table Master List */}
        <div className={cn(
          "bg-white rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col overflow-hidden transition-all duration-500",
          selectedTransaction ? "flex-1" : "w-full"
        )}>
          <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-center bg-zinc-50/50 gap-4">
             <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
                {['all', 'pending_approval', 'approved', 'paid'].map((tab) => (
                   <button 
                     key={tab}
                     onClick={() => setActiveTab(tab as any)}
                     className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                        activeTab === tab ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-900/10" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300"
                     )}
                   >
                      {tab === 'all' ? 'Ver Tudo' : tab.replace('_', ' ')}
                   </button>
                ))}
             </div>
             <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  placeholder="ID, Título, Categoria..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/5 bg-white"
                />
             </div>
          </div>

          <div className="overflow-auto flex-1">
             <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-zinc-50 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                   <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Transação</th>
                      <th className="px-6 py-4">Centro / Custo</th>
                      <th className="px-6 py-4">Vencimento</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                   {filteredTransactions.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedTransaction(tx)}
                        className={cn(
                           "group cursor-pointer transition-all",
                           selectedTransaction?.id === tx.id ? "bg-indigo-50/50 shadow-inner" : "hover:bg-zinc-50"
                        )}
                      >
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className={cn(
                                 "w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                                 tx.type === 'expense' ? "bg-rose-50 text-rose-500 border-rose-100" : "bg-emerald-50 text-emerald-500 border-emerald-100"
                               )}>
                                  {tx.type === 'expense' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                               </div>
                               <div>
                                  <p className="text-sm font-black text-zinc-900 leading-tight">{tx.title || tx.description}</p>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tight">{tx.category}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <span className="text-[10px] font-black uppercase text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md border border-zinc-200">
                               {tx.costCenter || 'Geral'}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                            <p className="text-sm font-bold text-zinc-700">18/06/2026</p>
                            <p className="text-[10px] font-black text-zinc-400 uppercase">Amanhã</p>
                         </td>
                         <td className="px-6 py-4">
                            <span className={cn(
                               "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                               tx.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                               tx.status === 'approved' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                               tx.status === 'pending_approval' ? "bg-amber-50 text-amber-600 border-amber-100 shadow-sm shadow-amber-200/50 animate-pulse" :
                               "bg-zinc-100 text-zinc-500 border-zinc-200"
                            )}>
                               {tx.status === 'paid' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                               {tx.status.replace('_', ' ')}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <p className={cn(
                               "text-lg font-black tracking-tight",
                               tx.type === 'expense' ? "text-rose-600" : "text-emerald-600"
                            )}>
                               {tx.type === 'expense' ? '-' : '+'} {formatCurrency(tx.amount)}
                            </p>
                         </td>
                      </tr>
                   ))}
                   {!filteredTransactions.length && (
                      <tr>
                        <td colSpan={5} className="py-24 text-center">
                           <DollarSign className="w-12 h-12 text-zinc-100 mx-auto mb-4" />
                           <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhuma transação encontrada nesta vista</p>
                        </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>

        {/* Dynamic Detail Sidepane */}
        <AnimatePresence>
          {selectedTransaction && (
            <motion.div 
               initial={{ opacity: 0, x: 50, width: 0 }}
               animate={{ opacity: 1, x: 0, width: '32rem' }}
               exit={{ opacity: 0, x: 50, width: 0 }}
               className="overflow-hidden flex-shrink-0"
            >
               <TransactionDetails 
                  transaction={selectedTransaction} 
                  onClose={() => setSelectedTransaction(null)}
                  userRole={userProfile?.role}
                  onApprove={(id) => handleUpdateStatus(id, 'approved')}
                  onReject={(id) => handleUpdateStatus(id, 'cancelled')}
                  onPay={(id) => handleUpdateStatus(id, 'paid')}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modern Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl relative z-10 overflow-hidden border border-zinc-200"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-zinc-900">Novo Lançamento Financeiro</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Fluxo Autorizativo de Governança</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-zinc-200 rounded-full text-zinc-400 transition-colors">
                   <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Título do Favorecido / Origem</label>
                    <input 
                      required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} 
                      placeholder="Ex: Pagamento AWS Cloud Services"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Valor Bruto (R$)</label>
                       <input 
                         required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} 
                         className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Modalidade</label>
                       <select 
                         value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} 
                         className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none"
                       >
                          <option value="expense">Saída (Despesa)</option>
                          <option value="income">Entrada (Receita)</option>
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Centro de Custo</label>
                       <select value={formData.costCenter} onChange={e => setFormData({...formData, costCenter: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none">
                          <option>Administrativo</option>
                          <option>TI / Infraestrutura</option>
                          <option>Operacional</option>
                          <option>Vendas</option>
                          <option>Logística</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Categoria Fiscal</label>
                       <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none">
                          <option>Serviços</option>
                          <option>Licenças de Software</option>
                          <option>Manutenção</option>
                          <option>Equipamentos</option>
                          <option>Impostos</option>
                       </select>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Anexar Nota Fiscal / Recibo</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "group relative border-2 border-dashed rounded-[2rem] p-6 transition-all cursor-pointer flex flex-col items-center justify-center gap-3",
                        selectedFile ? "border-indigo-500 bg-indigo-50/50 shadow-inner" : "border-zinc-200 hover:border-indigo-400 hover:bg-zinc-50"
                      )}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden" 
                        accept=".pdf,image/*"
                      />
                      {uploading ? (
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      ) : selectedFile ? (
                        <>
                          <Paperclip className="w-10 h-10 text-indigo-600" />
                          <span className="text-xs font-black text-indigo-900 truncate max-w-[80%] uppercase">{selectedFile.name}</span>
                          <p className="text-[10px] font-bold text-indigo-400">Clique para trocar arquivo</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-zinc-200 group-hover:text-indigo-400 transition-all" />
                          <div className="text-center">
                             <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Arraste ou Selecione Documento</p>
                             <p className="text-[9px] text-zinc-300 font-bold uppercase mt-1">PDF, JPG ou PNG • Máx 10MB</p>
                          </div>
                        </>
                      )}
                    </div>
                 </div>

                 <button 
                   type="submit" 
                   disabled={uploading}
                   className="w-full bg-zinc-900 text-white font-black uppercase tracking-[0.2em] text-[11px] py-5 rounded-[2rem] hover:bg-black transition-all shadow-2xl shadow-zinc-900/30 active:scale-95 disabled:opacity-50"
                 >
                    {uploading ? 'Processando Documentos...' : 'Lançar no Ledger Corporativo'}
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

