import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Transaction, TransactionStatus, UserProfile } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Filter, Plus, Calendar, Tag, X, Check, ShieldAlert, FileText, Repeat, Upload, Paperclip, ExternalLink, Loader2, Download } from 'lucide-react';
import { formatCurrency, cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function FinanceModule() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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

    if (userProfile?.role === 'OPERATOR' && (newStatus === 'approved' || newStatus === 'paid')) {
      toast.error('Privilégios insuficientes para aprovação.');
      return;
    }

    try {
      await updateDoc(doc(db, 'transactions', id), { 
        status: newStatus,
        approvedBy: userProfile?.displayName || 'System'
      });
      
      await logAudit('status_change', 'transactions', id, { 
        before: { status: transaction.status }, 
        after: { status: newStatus } 
      });
      
      toast.info(`Status atualizado para: ${newStatus.toUpperCase()}`);
      
      if (newStatus === 'approved' || newStatus === 'paid') {
        await pushNotification({
          userId: transaction.requestedBy === 'System' ? undefined : (await (async () => {
             // Ideally we'd find the user ID, but for now we notify the role or requester name
             // For simplicity in this demo, we notify based on type
             return undefined; 
          })()),
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

  const handleDeleteTransaction = async (id: string, title: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!id || !confirm(`Remover registro de "${title}"? Esta operação será registrada no log de auditoria.`)) return;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      await logAudit('delete', 'transactions', id, { before: transaction });
      toast.info('Transação removida.');
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error('Erro ao excluir registro.');
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
    pending: transactions.filter(t => t.status === 'pending_approval').length
  };

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'approved': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending_approval': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'cancelled': return 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through';
      default: return 'bg-zinc-100 text-zinc-800 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Finanças & Fluxo de Aprovação
          </h2>
          <p className="text-zinc-500 mt-1">Gestão de alçadas e tesouraria para o grupo inicial de 30 colaboradores.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dashboardStats.pending > 0 && (
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span className="text-xs font-bold">{dashboardStats.pending} Aprovações Pendentes</span>
            </div>
          )}
          <button 
            onClick={handleExportCSV}
            className="flex items-center space-x-2 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-600 px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Download className="w-5 h-5" />
            <span className="font-bold">Exportar CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-zinc-900/10 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="font-bold">Novo Lançamento</span>
          </button>
        </div>
      </div>

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
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white rotate-3">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900">Registro de Transação</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Fluxo Administrativo de Alçada</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddTransaction} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Descrição do Lançamento</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Valor Final (R$)</label>
                    <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Modalidade</label>
                    <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none">
                      <option value="income">Entrada (Income)</option>
                      <option value="expense">Saída (Expense)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Categoria Fiscal</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none">
                      <option>Serviços</option>
                      <option>Infraestrutura</option>
                      <option>Tecnologia</option>
                      <option>Salários</option>
                      <option>Suprimentos</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Centro de Custo</label>
                    <select value={formData.costCenter} onChange={e => setFormData({...formData, costCenter: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm outline-none">
                      <option>Administrativo</option>
                      <option>Vendas</option>
                      <option>TI / Engenharia</option>
                      <option>Logística</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <input 
                    type="checkbox" 
                    checked={formData.isRecurring} 
                    onChange={e => setFormData({...formData, isRecurring: e.target.checked})}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tight">Lançamento Recorrente</span>
                    <p className="text-[9px] text-zinc-400">Automatizar este lançamento nos próximos meses.</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Comprovante / Anexo (PDF/IMG)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "group relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer flex flex-col items-center justify-center gap-2",
                      selectedFile ? "border-emerald-500 bg-emerald-50/30" : "border-zinc-200 hover:border-emerald-400 hover:bg-zinc-50"
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
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    ) : selectedFile ? (
                      <>
                        <Paperclip className="w-8 h-8 text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700 truncate max-w-full px-4">{selectedFile.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="absolute top-2 right-2 p-1 rounded-full bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-zinc-300 group-hover:text-emerald-400 transition-colors" />
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Clique para anexar documento</span>
                      </>
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={uploading}
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Processando Documentos...' : 'Confirmar & Processar'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <DollarSign className="w-16 h-16" />
          </div>
          <p className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-1">Tesouraria Atual</p>
          <p className="text-3xl font-black text-zinc-900">{formatCurrency(dashboardStats.income - dashboardStats.expense)}</p>
          <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center text-xs text-zinc-400 font-medium">
            <Calendar className="w-3 h-3 mr-1" /> Fluxo conciliado em tempo real
          </div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Aprovadas (Entradas)</p>
          <p className="text-3xl font-black text-emerald-700">{formatCurrency(dashboardStats.income)}</p>
          <div className="mt-4 flex items-center text-[10px] text-emerald-500 font-black uppercase tracking-tight">
            <ArrowUpRight className="w-4 h-4 mr-1" /> Receita Auditada
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-xs font-black text-red-600 uppercase tracking-widest mb-1">Comprometidas (Saídas)</p>
          <p className="text-3xl font-black text-red-700">{formatCurrency(dashboardStats.expense)}</p>
          <div className="mt-4 flex items-center text-[10px] text-red-500 font-black uppercase tracking-tight">
            <ArrowDownLeft className="w-4 h-4 mr-1" /> Despesa Validada
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="font-black text-zinc-900 uppercase tracking-tight text-sm">Ledger Corporativo</h3>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">Controle de alçadas logado</p>
          </div>
          <button className="flex items-center space-x-2 text-zinc-500 hover:text-zinc-700 text-[10px] font-black uppercase tracking-widest bg-white px-3 py-2 rounded-lg border border-zinc-200 shadow-sm">
            <Filter className="w-4 h-4" />
            <span>Filtros Avançados</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Origem/Alvo</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Setor</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Valor Auditado</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Status Transacional</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Aprovação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {transactions.map((t, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  key={t.id} 
                  className="hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center border",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 leading-tight">{t.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] text-zinc-400 flex items-center gap-1">
                            <Tag className="w-2 h-2" /> {t.category} 
                            {t.isRecurring && <Repeat className="w-2 h-2 ml-1 text-blue-500" />}
                          </p>
                          {t.attachmentUrl && (
                            <a 
                              href={t.attachmentUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                            >
                              <Paperclip className="w-2 h-2" />
                              Ver Anexo
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] font-black uppercase bg-zinc-100 text-zinc-600 px-2.5 py-1 rounded-md border border-zinc-200">
                      {t.costCenter}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-semibold text-zinc-700">{t.date.toLocaleDateString('pt-BR')}</p>
                    <p className="text-[10px] text-zinc-400">{t.date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</p>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-sm font-black text-right",
                    t.type === 'income' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border",
                      getStatusBadge(t.status)
                    )}>
                      {t.status.replace('_', ' ')}
                    </span>
                    {t.approvedBy && (
                      <p className="text-[8px] text-zinc-400 mt-1 uppercase font-bold">Por: {t.approvedBy}</p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {t.status === 'pending_approval' && (userProfile?.role === 'ADMIN' || userProfile?.role === 'MANAGER') && (
                        <>
                          <button 
                            onClick={() => t.id && handleUpdateStatus(t.id, 'approved')}
                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-emerald-100 rounded-lg transition-all"
                            title="Aprovar Lançamento"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => t.id && handleUpdateStatus(t.id, 'cancelled')}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 rounded-lg transition-all"
                            title="Reprovar Lançamento"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      {t.status === 'approved' && (userProfile?.role === 'ADMIN' || userProfile?.role === 'MANAGER') && (
                        <button 
                          onClick={() => t.id && handleUpdateStatus(t.id, 'paid')}
                          className="px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Liquidado
                        </button>
                      )}

                      {(userProfile?.role === 'ADMIN') && (
                        <button 
                          onClick={() => t.id && handleDeleteTransaction(t.id, t.title)}
                          className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

