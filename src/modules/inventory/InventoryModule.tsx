import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { 
  collection, query, onSnapshot, addDoc, serverTimestamp, 
  deleteDoc, doc, updateDoc, increment, orderBy, where 
} from 'firebase/firestore';
import { InventoryItem, Asset, StockMovement, UserProfile, Employee } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { 
  Box, Plus, Search, AlertTriangle, ArrowUpDown, 
  MoreVertical, PackageCheck, History, X, Laptop, 
  Wrench, Move, ArrowUpRight, ArrowDownLeft, Filter,
  Tag, MapPin, Hash, User, TrendingUp, Package,
  ChevronRight, ArrowRightLeft, ShieldAlert, CheckCircle2,
  DollarSign
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import ItemDetailsWidget from './components/ItemDetailsWidget';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function InventoryModule() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeTab, setActiveTab] = useState<'consumable' | 'asset'>('consumable');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    quantity: 0,
    minQuantity: 5,
    unitPrice: 0,
    category: 'Hardware',
    type: 'consumable' as 'consumable' | 'asset',
    location: 'Estoque Central',
    serialNumber: '',
    assignedTo: '',
    assignedToId: '',
    condition: 'new' as any,
    supplier: ''
  });

  const [transferData, setTransferData] = useState({
    newOwnerId: '',
    newOwnerName: ''
  });

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        onSnapshot(doc(db, 'users', user.uid), (s) => setUserProfile(s.data() as UserProfile));
      }
    });

    const qInv = query(collection(db, 'inventory'), orderBy('name'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem)));
    });

    const qEmp = query(collection(db, 'employees'), where('status', '==', 'active'));
    const unsubEmp = onSnapshot(qEmp, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => { unsubAuth(); unsubInv(); unsubEmp(); };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const itemData: any = {
        name: formData.name,
        sku: formData.sku,
        quantity: formData.quantity,
        minQuantity: formData.minQuantity,
        unitPrice: formData.unitPrice,
        category: formData.category,
        type: formData.type,
        location: formData.location,
        supplier: formData.supplier,
        lastRestockedAt: serverTimestamp(),
        status: formData.quantity <= 0 ? 'out_of_stock' : (formData.quantity <= formData.minQuantity ? 'low_stock' : 'available')
      };

      if (formData.type === 'asset') {
        itemData.serialNumber = formData.serialNumber;
        itemData.assignedTo = formData.assignedTo;
        itemData.assignedToId = formData.assignedToId;
        itemData.condition = formData.condition;
        itemData.acquisitionDate = serverTimestamp();
        itemData.warrantyExpiration = null; // Could be added to form
      }

      const docRef = await addDoc(collection(db, 'inventory'), itemData);
      await logAudit('create', 'inventory', docRef.id, { after: itemData });

      toast.success(`${formData.name} registrado no Ledger de Ativos.`);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro na gravação do registro.');
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedItem.id || !transferData.newOwnerId) return;

    try {
      const emp = employees.find(e => e.id === transferData.newOwnerId);
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        assignedTo: emp?.name,
        assignedToId: emp?.id
      });

      await logAudit('transfer', 'inventory', selectedItem.id, { 
        before: { assignedTo: (selectedItem as any).assignedTo },
        after: { assignedTo: emp?.name }
      });

      toast.success(`Ativo transferido com sucesso para ${emp?.name}`);
      setIsTransferModalOpen(false);
      setSelectedItem(prev => prev ? { ...prev, assignedTo: emp?.name, assignedToId: emp?.id } as any : null);
    } catch (error) {
      toast.error('Erro na transferência de titularidade.');
    }
  };

  const [moveData, setMoveData] = useState({
    quantity: 1,
    reason: 'purchase' as any,
    ticketProtocol: ''
  });

  const resetForm = () => {
    setFormData({
      name: '', sku: '', quantity: 0, minQuantity: 5, unitPrice: 0,
      category: 'Hardware', type: 'consumable', location: 'Estoque Central',
      serialNumber: '', assignedTo: '', assignedToId: '', condition: 'new',
      supplier: ''
    });
  };

  const generateLowStockTicket = async (item: any) => {
    const protocol = `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    await addDoc(collection(db, 'tickets'), {
      title: `Reposição: ${item.name}`,
      description: `O estoque de ${item.name} atingiu o nível crítico (${item.quantity} un). SKU: ${item.sku}. Reposição mínima sugerida: ${item.minQuantity * 2} un.`,
      priority: 'high',
      category: 'Purchasing',
      protocol,
      status: 'open',
      requesterId: 'system',
      requesterName: 'Inventory System',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await pushNotification({
      role: 'ADMIN',
      title: 'Alerta de Estoque',
      message: `${item.name} atingiu nível crítico (${item.quantity} unidades).`,
      type: 'system',
      link: 'inventory'
    });
  };

  const handleMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedItem.id) return;

    try {
      const user = auth.currentUser;
      const isExit = moveData.reason !== 'purchase';
      const movementQty = isExit ? -Math.abs(moveData.quantity) : Math.abs(moveData.quantity);
      const newQty = selectedItem.quantity + movementQty;

      if (newQty < 0) {
        toast.error('Saldo insuficiente no estoque.');
        return;
      }

      const movement: StockMovement = {
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: movementQty,
        reason: moveData.reason,
        ticketProtocol: moveData.ticketProtocol || undefined,
        performedBy: user?.displayName || 'Sistema',
        performedById: user?.uid || 'system',
        timestamp: serverTimestamp()
      };

      const newStatus = newQty <= 0 ? 'out_of_stock' : (newQty <= selectedItem.minQuantity ? 'low_stock' : 'available');
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        quantity: newQty,
        status: newStatus,
        lastRestockedAt: isExit ? selectedItem.lastRestockedAt : serverTimestamp()
      });

      await addDoc(collection(db, 'movements'), movement);
      await logAudit('update', 'inventory', selectedItem.id, { 
        before: { quantity: selectedItem.quantity }, 
        after: { quantity: newQty, reason: moveData.reason } 
      });

      if (newStatus === 'low_stock' || newStatus === 'out_of_stock') {
        await generateLowStockTicket({...selectedItem, quantity: newQty});
      }

      toast.success('Movimentação registrada.');
      setIsMoveModalOpen(false);
    } catch (error) {
      toast.error('Erro na movimentação.');
    }
  };

  const handleUpdateMovement = async (e: React.FormEvent) => {
    await handleMovement(e);
    // Refresh selected item from state if open
    if (selectedItem) {
      const updated = items.find(i => i.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    }
  };

  const dashboardStats = {
    totalValue: items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0),
    assetsCount: items.filter(i => i.type === 'asset').length,
    criticalItems: items.filter(i => i.status !== 'available'),
    capacity: 78, // Mocked overall capacity
  };

  const chartData = [
    { name: 'Consumíveis', value: items.filter(i => i.type === 'consumable').length },
    { name: 'Patrimônio', value: items.filter(i => i.type === 'asset').length },
  ];

  const filteredItems = items.filter(i => {
    const matchesTab = i.type === activeTab;
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         i.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-12 h-screen flex flex-col">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
             <PackageCheck className="w-8 h-8 text-indigo-600" />
             Estoque & Patrimônio Enterprise
          </h1>
          <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-[0.2em]">Gestão Imobilizada • Controle de Insumos • Auditoria Ativos</p>
        </div>
        <div className="flex gap-3">
          <button 
            className="bg-zinc-100 text-zinc-600 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" /> Movimentações
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-3 active:scale-95"
          >
            <Plus className="w-5 h-5" /> Novo Registro
          </button>
        </div>
      </div>

      {/* Advanced Dashboard Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-shrink-0">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 border border-zinc-200 shadow-sm flex flex-col md:flex-row gap-8 items-center relative overflow-hidden">
           <div className="space-y-6 w-full md:w-1/2 relative z-10">
              <div className="flex items-center justify-between">
                 <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">VGV Total Auditado</p>
                    <p className="text-3xl font-black text-zinc-900">{formatCurrency(dashboardStats.totalValue)}</p>
                 </div>
                 <div className="w-12 h-12 bg-zinc-900 text-white rounded-2xl flex items-center justify-center rotate-3">
                    <DollarSign className="w-6 h-6" />
                 </div>
              </div>

              <div className="space-y-2">
                 <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span className="text-zinc-400">Capacidade Operacional</span>
                    <span className="text-zinc-900">{dashboardStats.capacity}%</span>
                 </div>
                 <div className="h-3 bg-zinc-100 rounded-full border border-zinc-200 overflow-hidden p-0.5">
                    <motion.div 
                       initial={{ width: 0 }} animate={{ width: `${dashboardStats.capacity}%` }}
                       className="h-full bg-indigo-600 rounded-full"
                    />
                 </div>
              </div>
           </div>
           
           <div className="flex-1 h-32 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie 
                       data={chartData} innerRadius={35} outerRadius={50} paddingAngle={8} dataKey="value"
                       stroke="none"
                    >
                       <Cell fill="#4f46e5" />
                       <Cell fill="#18181b" />
                    </Pie>
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1rem', border: 'none', background: '#18181b', color: 'white', fontSize: '10px' }} />
                 </PieChart>
              </ResponsiveContainer>
              <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 space-y-1">
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-600" /> Consumíveis</div>
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-zinc-900" /> Patrimônio</div>
              </div>
           </div>
        </div>

        <div className={cn(
           "rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl transition-all duration-500",
           dashboardStats.criticalItems.length > 0 ? "bg-rose-600 shadow-rose-600/30" : "bg-zinc-900 shadow-zinc-900/40"
        )}>
           <ShieldAlert className="absolute top-[-20%] right-[-10%] w-64 h-64 text-white/5 rotate-12" />
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">Itens Críticos</p>
              <h3 className="text-4xl font-black">{dashboardStats.criticalItems.length}</h3>
              <p className="text-[10px] font-bold text-white/60 mt-2 uppercase tracking-widest">Geração de Tickets Automática</p>
           </div>
           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between relative z-10 border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-widest">Ver Urgências</span>
              <ArrowUpRight className="w-4 h-4 opacity-40" />
           </div>
        </div>

        <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden flex flex-col justify-between shadow-2xl shadow-emerald-600/20">
           <Package className="absolute bottom-[-10%] right-[-10%] w-48 h-48 text-white/5 -rotate-12" />
           <div className="relative z-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">Ativos Imobilizados</p>
              <h3 className="text-4xl font-black">{dashboardStats.assetsCount}</h3>
           </div>
           <div className="text-[9px] font-black uppercase tracking-widest text-emerald-100 flex items-center gap-2 bg-black/10 self-start px-3 py-1.5 rounded-full border border-white/5">
              <CheckCircle2 className="w-3 h-3" /> Auditado: 100%
           </div>
        </div>
      </div>

      {/* Workspace: Master-Detail Split */}
      <div className="flex gap-6 flex-1 min-h-0">
        <div className={cn(
          "bg-white rounded-[2rem] border border-zinc-200 shadow-sm flex flex-col overflow-hidden transition-all duration-500",
          selectedItem ? "flex-1" : "w-full"
        )}>
          <div className="flex border-b border-zinc-100 bg-zinc-50/50">
             {['consumable', 'asset'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={cn(
                     "px-8 py-5 text-[10px] font-black uppercase tracking-widest transition-all relative",
                     activeTab === tab ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                  )}
                >
                   {tab === 'consumable' ? 'Insumos & Consumíveis' : 'Patrimônio & Ativos'}
                   {activeTab === tab && (
                      <motion.div layoutId="tabUnderlineInv" className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900" />
                   )}
                </button>
             ))}
          </div>

          <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-center gap-4">
             <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                <input 
                  type="text" 
                  placeholder="SKU, Nome, Número de Série..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/5 bg-white"
                />
             </div>
             <button className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors">
                <Filter className="w-4 h-4" /> Mais Filtros
             </button>
          </div>

          <div className="overflow-auto flex-1">
             <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-zinc-50 shadow-[0_1px_0_0_rgba(228,228,231,1)]">
                   <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Item / SKU</th>
                      <th className="px-6 py-4">Localização / Alocação</th>
                      <th className="px-6 py-4">Status / Saúde</th>
                      <th className="px-6 py-4 text-right">Saldo / Valor</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                   {filteredItems.map((tx) => (
                      <tr 
                        key={tx.id} 
                        onClick={() => setSelectedItem(tx)}
                        className={cn(
                           "group cursor-pointer transition-all",
                           selectedItem?.id === tx.id ? "bg-indigo-50/50" : "hover:bg-zinc-50"
                        )}
                      >
                         <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                               <div className={cn(
                                 "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all",
                                 tx.type === 'asset' ? "bg-amber-50 text-amber-500 border-amber-100" : "bg-zinc-50 text-zinc-900 border-zinc-200"
                               )}>
                                  {tx.type === 'asset' ? <Laptop className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                               </div>
                               <div>
                                  <p className="text-sm font-black text-zinc-900 leading-tight">{tx.name}</p>
                                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-tight">SKU: {tx.sku}</p>
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-tighter">
                                  <MapPin className="w-3 h-3" /> {tx.location}
                               </div>
                               {tx.type === 'asset' && (tx as any).assignedTo && (
                                  <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                                     <User className="w-3 h-3" /> {(tx as any).assignedTo}
                                  </div>
                               )}
                            </div>
                         </td>
                         <td className="px-6 py-5">
                            <div className="flex flex-col gap-2 w-32">
                               <div className="flex justify-between items-center">
                                  <span className={cn(
                                     "text-[9px] font-black uppercase tracking-widest",
                                     tx.status === 'available' ? "text-emerald-500" : "text-rose-500"
                                  )}>{tx.status.replace('_', ' ')}</span>
                                  <span className="text-[9px] font-bold text-zinc-400">{tx.quantity} un</span>
                               </div>
                               <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200 p-[1px]">
                                  <div 
                                    className={cn(
                                       "h-full rounded-full transition-all duration-1000",
                                       tx.status === 'available' ? "bg-emerald-500" : "bg-rose-500"
                                    )} 
                                    style={{ width: `${Math.min(100, (tx.quantity / (tx.minQuantity * 2)) * 100)}%` }} 
                                  />
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-5 text-right">
                            <p className="text-sm font-black text-zinc-900">{formatCurrency(tx.unitPrice * tx.quantity)}</p>
                            <p className="text-[10px] font-black text-zinc-400 uppercase">Total Auditado</p>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
        </div>

        {/* Master Detail Sidepane */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div 
               initial={{ opacity: 0, x: 50, width: 0 }} animate={{ opacity: 1, x: 0, width: '32rem' }} exit={{ opacity: 0, x: 50, width: 0 }}
               className="overflow-hidden flex-shrink-0"
            >
               <ItemDetailsWidget 
                  item={selectedItem} 
                  onClose={() => setSelectedItem(null)} 
                  onMovement={() => setIsMoveModalOpen(true)}
                  onTransfer={() => setIsTransferModalOpen(true)}
                  userRole={userProfile?.role}
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transfer Modal */}
      <AnimatePresence>
         {isTransferModalOpen && selectedItem && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
               <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative border border-zinc-200"
               >
                  <div className="flex items-center justify-between mb-8">
                     <div>
                        <h3 className="text-2xl font-black text-zinc-900 leading-tight">Transferir Ativo</h3>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Link de Patrimônio: RH → Estoque</p>
                     </div>
                     <button onClick={() => setIsTransferModalOpen(false)} className="p-3 hover:bg-zinc-100 rounded-full text-zinc-400">
                        <X className="w-6 h-6" />
                     </button>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-center gap-4 mb-10">
                     <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        <Laptop className="w-6 h-6" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Equipamento Selecionado</p>
                        <p className="text-lg font-black text-indigo-900">{selectedItem.name}</p>
                     </div>
                  </div>

                  <form onSubmit={handleTransferOwnership} className="space-y-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Novo Colaborador Responsável</label>
                        <select 
                           required value={transferData.newOwnerId} onChange={e => setTransferData({...transferData, newOwnerId: e.target.value})}
                           className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMUw2IDZMMTIgMSIgc3Ryb2tlPSIjQTFBMUEzIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[length:12px_8px] bg-[right_1.5rem_center] bg-no-repeat"
                        >
                           <option value="">Selecione o Colaborador...</option>
                           {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name} • {emp.role}</option>
                           ))}
                        </select>
                     </div>

                     <button 
                        type="submit" 
                        className="w-full bg-zinc-900 text-white font-black uppercase tracking-[0.2em] text-[11px] py-6 rounded-[2rem] hover:bg-black transition-all shadow-2xl shadow-zinc-900/40 active:scale-95 flex items-center justify-center gap-3"
                     >
                        <ArrowRightLeft className="w-4 h-4" /> Efetuar Transferência Técnica
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
                    <Plus className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 leading-tight">Novo Ativo / Cadastro</h3>
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Protocolo de Governança Enterprise</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-zinc-100 rounded-full text-zinc-400">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-8">
                 <div className="flex p-1.5 bg-zinc-100 rounded-[1.5rem] w-full">
                    <button 
                      type="button" onClick={() => setFormData({...formData, type: 'consumable'})}
                      className={cn("flex-1 py-4 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'consumable' ? "bg-white text-zinc-900 shadow-xl" : "text-zinc-400")}
                    >Insumo Recomprável</button>
                    <button 
                      type="button" onClick={() => setFormData({...formData, type: 'asset'})}
                      className={cn("flex-1 py-4 rounded-[1rem] text-[10px] font-black uppercase tracking-widest transition-all", formData.type === 'asset' ? "bg-white text-zinc-900 shadow-xl" : "text-zinc-400")}
                    >Ativo Imobilizado</button>
                 </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Nome Descritivo (Master Data)</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Monitor Ultra-Wide 34' LG" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Código SKU / PartNumber</label>
                    <input required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="PRT-XXX-YYY" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-mono focus:ring-4 focus:ring-indigo-500/10 outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Categoria Fiscal</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black outline-none">
                      <option>Hardware</option>
                      <option>Mobiliário</option>
                      <option>Licenças</option>
                      <option>Suprimentos Escritório</option>
                    </select>
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Posição no Estoque</label>
                     <input required type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-lg font-black" />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Estoque Min. (Alerta)</label>
                     <input required type="number" value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: parseInt(e.target.value)})} className="w-full bg-rose-50 border border-rose-100 rounded-2xl px-6 py-4 text-lg font-black text-rose-600" />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 block">Fornecedor Padrão (Vendor)</label>
                    <input value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="Ex: Dell Technologies Inc." className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm font-black" />
                  </div>

                  {formData.type === 'asset' && (
                    <div className="col-span-2 space-y-6 pt-4 border-t border-zinc-100">
                       <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Patrimônio Específico</p>
                       <div className="grid grid-cols-2 gap-6">
                          <div>
                             <label className="text-[10px] font-black text-zinc-400 uppercase mb-3 block">S/N - Serial Number</label>
                             <input value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} placeholder="NS-XXXX-YYYY" className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 font-mono text-xs" />
                          </div>
                          <div>
                             <label className="text-[10px] font-black text-zinc-400 uppercase mb-3 block">Colaborador (Opcional)</label>
                             <select value={formData.assignedToId} onChange={e => {
                                const emp = employees.find(emp => emp.id === e.target.value);
                                setFormData({...formData, assignedToId: e.target.value, assignedTo: emp?.name || ''});
                             }} className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl px-6 py-4 text-xs font-black">
                                <option value="">No Estoque</option>
                                {employees.map(emp => (
                                   <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                             </select>
                          </div>
                       </div>
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] hover:bg-black transition-all shadow-[0_20px_50px_rgba(24,24,27,0.3)] uppercase tracking-[0.2em] text-[11px] active:scale-[0.98]">
                  Efetivar Registro Ledgér
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMoveModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-md">
            <motion.div 
               initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
               className="bg-white rounded-[3rem] p-10 w-full max-w-lg shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 leading-tight">Movimentação Crítica</h3>
                  <p className="text-zinc-400 text-[10px] font-black mt-2 uppercase tracking-widest">{selectedItem.name} • SKU: {selectedItem.sku}</p>
                </div>
                <button onClick={() => setIsMoveModalOpen(false)} className="p-3 hover:bg-zinc-100 rounded-full text-zinc-400">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 text-center">
                   <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Saldo Atual</p>
                   <p className="text-3xl font-black text-zinc-900">{selectedItem.quantity}</p>
                </div>
                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 text-center">
                   <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">Ponto de Alerta</p>
                   <p className="text-3xl font-black text-rose-600">{selectedItem.minQuantity}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateMovement} className="space-y-8">
                <div>
                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 block">Justificativa da Operação</label>
                   <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'purchase', label: 'Compra/Entrada', icon: ArrowUpRight, color: 'text-emerald-500' },
                        { id: 'ticket_fulfillment', label: 'Saída Projetos', icon: ArrowDownLeft, color: 'text-indigo-500' },
                        { id: 'adjustment', label: 'Ajuste Auditivo', icon: ShieldAlert, color: 'text-amber-500' },
                        { id: 'disposal', label: 'Descarte/Quebra', icon: ArrowDownLeft, color: 'text-rose-500' }
                      ].map((reason) => (
                        <button 
                          key={reason.id} type="button"
                          onClick={() => setMoveData({...moveData, reason: reason.id as any})}
                          className={cn(
                            "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                            moveData.reason === reason.id ? "bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/10" : "bg-white border-zinc-200 hover:border-zinc-400 shadow-sm"
                          )}
                        >
                          <reason.icon className={cn("w-4 h-4", moveData.reason === reason.id ? "text-white" : reason.color)} />
                          <span className="text-[10px] font-bold uppercase tracking-tighter">{reason.label}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Quantidade</label>
                     <input required type="number" min="1" value={moveData.quantity} onChange={e => setMoveData({...moveData, quantity: parseInt(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-2xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 text-center shadow-inner" />
                   </div>
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Protocolo Fiscal</label>
                     <input value={moveData.ticketProtocol} onChange={e => setMoveData({...moveData, ticketProtocol: e.target.value})} placeholder="NF-XXX / TCK-YYY" className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-5 text-sm font-mono placeholder:text-zinc-300 focus:ring-4 focus:ring-indigo-500/10 outline-none shadow-inner" />
                   </div>
                </div>

                <button type="submit" className="w-full bg-zinc-900 text-white font-black py-6 rounded-[2rem] hover:bg-black transition-all shadow-2xl shadow-zinc-900/40 uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-[0.98]">
                   {moveData.reason === 'purchase' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                   Efetivar Movimentação Auditada
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

