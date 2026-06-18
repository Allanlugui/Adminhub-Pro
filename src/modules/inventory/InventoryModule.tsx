import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, increment, orderBy } from 'firebase/firestore';
import { InventoryItem, Asset, StockMovement } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { pushNotification } from '@/src/lib/notifications';
import { 
  Box, Plus, Search, AlertTriangle, ArrowUpDown, 
  MoreVertical, PackageCheck, History, X, Laptop, 
  Wrench, Move, ArrowUpRight, ArrowDownLeft, Filter,
  Tag, MapPin, Hash, User
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function InventoryModule() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'consumable' | 'asset'>('consumable');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  
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
    condition: 'new' as any
  });

  const [moveData, setMoveData] = useState({
    quantity: 1,
    reason: 'purchase' as any,
    ticketProtocol: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      setItems(docs);
    });
    return () => unsubscribe();
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
        lastRestockedAt: serverTimestamp(),
        status: formData.quantity <= 0 ? 'out_of_stock' : (formData.quantity <= formData.minQuantity ? 'low_stock' : 'available')
      };

      if (formData.type === 'asset') {
        itemData.serialNumber = formData.serialNumber;
        itemData.assignedTo = formData.assignedTo;
        itemData.condition = formData.condition;
        itemData.acquisitionDate = serverTimestamp();
      }

      const docRef = await addDoc(collection(db, 'inventory'), itemData);
      await logAudit('create', 'inventory', docRef.id, { after: itemData });

      // Low Stock Ticket Generation
      if (itemData.quantity <= itemData.minQuantity) {
        await generateLowStockTicket(itemData);
      }
      
      toast.success(`${formData.name} registrado com sucesso!`);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Erro ao registrar item.');
    }
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

      // Update Inventory
      const newStatus = newQty <= 0 ? 'out_of_stock' : (newQty <= selectedItem.minQuantity ? 'low_stock' : 'available');
      await updateDoc(doc(db, 'inventory', selectedItem.id), {
        quantity: newQty,
        status: newStatus,
        lastRestockedAt: isExit ? selectedItem.lastRestockedAt : serverTimestamp()
      });

      // Log Movement and Audit
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

  const resetForm = () => {
    setFormData({
      name: '', sku: '', quantity: 0, minQuantity: 5, unitPrice: 0,
      category: 'Hardware', type: 'consumable', location: 'Estoque Central',
      serialNumber: '', assignedTo: '', condition: 'new'
    });
  };

  const filteredItems = items.filter(i => i.type === activeTab);
  const lowStockCount = items.filter(i => i.status !== 'available').length;
  const totalValue = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Estoque & Patrimônio</h2>
          <p className="text-zinc-500">Gestão integrada de insumos e ativos imobilizados.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 text-zinc-600 hover:text-zinc-800 bg-white border border-zinc-200 px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <History className="w-5 h-5 text-zinc-400" />
            <span className="font-semibold">Log de Movimentação</span>
          </button>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Novo Registro</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total SKU</p>
            <p className="text-xl font-black text-zinc-900">{items.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">VGV Estoque</p>
            <p className="text-xl font-black text-zinc-900">{formatCurrency(totalValue)}</p>
          </div>
        </div>
        <div className={cn(
          "p-4 rounded-xl border flex items-center space-x-4",
          lowStockCount > 0 ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-white border-zinc-200"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center border",
            lowStockCount > 0 ? "bg-rose-100 text-rose-600 border-rose-200" : "bg-zinc-50 text-zinc-400 border-zinc-200"
          )}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold opacity-70 uppercase tracking-wider">Alertas</p>
            <p className="text-xl font-black">{lowStockCount} itens</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-zinc-200 flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-zinc-50 text-zinc-500 flex items-center justify-center border border-zinc-200">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Ativos de TI</p>
            <p className="text-xl font-black text-zinc-900">{items.filter(i => i.type === 'asset').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-zinc-100">
          <button 
            onClick={() => setActiveTab('consumable')}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all",
              activeTab === 'consumable' ? "border-zinc-900 text-zinc-900 bg-zinc-50/50" : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            Insumos & Consumíveis
          </button>
          <button 
            onClick={() => setActiveTab('asset')}
            className={cn(
              "px-6 py-4 text-sm font-bold border-b-2 transition-all",
              activeTab === 'asset' ? "border-zinc-900 text-zinc-900 bg-zinc-50/50" : "border-transparent text-zinc-400 hover:text-zinc-600"
            )}
          >
            Patrimônio & Ativos
          </button>
        </div>

        <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input type="text" placeholder={`Buscar em ${activeTab === 'consumable' ? 'consumíveis' : 'ativos'}...`} className="w-full bg-white border border-zinc-200 rounded-lg py-2 pl-10 pr-4 text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <button className="text-xs font-bold bg-white border border-zinc-200 text-zinc-600 px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center gap-2">
              <Filter className="w-3 h-3" /> Filtrar
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-16">Icon</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Informações Gerais</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Localização</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Status / Saldo</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Custo Unit.</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredItems.map((item, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                  key={item.id} className="hover:bg-zinc-50/50 group transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center border group-hover:scale-110 transition-transform shadow-sm",
                      item.type === 'asset' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-zinc-50 text-zinc-900 border-zinc-200"
                    )}>
                      {item.type === 'asset' ? <Laptop className="w-6 h-6" /> : <Box className="w-6 h-6" />}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-zinc-900 leading-tight">{item.name}</p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-1 flex items-center gap-2">
                       <Tag className="w-3 h-3" /> {item.sku}
                    </p>
                    {item.type === 'asset' && (
                      <p className="text-[10px] text-zinc-500 font-bold mt-1 uppercase flex items-center gap-1">
                        <Hash className="w-3 h-3" /> SN: {(item as any).serialNumber || '---'}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                       <MapPin className="w-3 h-3 text-zinc-400" /> {item.location}
                    </div>
                    {item.type === 'asset' && (item as any).assignedTo && (
                      <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 mt-1 uppercase">
                         <User className="w-3 h-3" /> {(item as any).assignedTo}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <div className="flex items-end gap-1">
                        <span className={cn(
                          "text-base font-black leading-none",
                          item.status === 'out_of_stock' ? "text-red-500" : (item.status === 'low_stock' ? "text-amber-500" : "text-emerald-500")
                        )}>{item.quantity}</span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">un/unid</span>
                      </div>
                      <div className="w-16 h-1 bg-zinc-100 rounded-full mt-2 border border-zinc-200 overflow-hidden">
                        <div 
                          style={{ width: `${Math.min(100, (item.quantity / (item.minQuantity * 3)) * 100)}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            item.status === 'out_of_stock' ? "bg-red-500" : (item.status === 'low_stock' ? "bg-amber-500" : "bg-emerald-500")
                          )}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold text-zinc-900">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedItem(item); setIsMoveModalOpen(true); }}
                        className="p-2 text-zinc-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Move className="w-5 h-5" />
                      </button>
                      <button className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                 <PackageCheck className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">Nenhum {activeTab === 'consumable' ? 'insumo' : 'ativo'} localizado</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl border border-zinc-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900 leading-tight">Registrar Recurso</h3>
                  <p className="text-sm text-zinc-500 font-medium">Cadastramento Enterprise de Insumos e Ativos.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="space-y-6">
                 {/* Type Selector */}
                 <div className="flex p-1 bg-zinc-100 rounded-2xl w-full">
                    <button 
                      type="button" onClick={() => setFormData({...formData, type: 'consumable'})}
                      className={cn("flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tighter transition-all", formData.type === 'consumable' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                    >Consumível (Insumos)</button>
                    <button 
                      type="button" onClick={() => setFormData({...formData, type: 'asset'})}
                      className={cn("flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-tighter transition-all", formData.type === 'asset' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}
                    >Imobilizado (Patrimônio)</button>
                 </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Identificação do Item</label>
                    <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: Notebook Dell G15" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-zinc-900/5 outline-none font-bold" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">SKU / Código Interno</label>
                    <input required value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="SKU-2024-XXX" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-zinc-900/5 outline-none font-mono" />
                  </div>

                  <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Qtd. Inicial</label>
                     <input required type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-black" />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Estoque Crítico (Min)</label>
                     <input required type="number" value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: parseInt(e.target.value)})} className="w-full bg-rose-50/50 border border-rose-100 rounded-xl px-4 py-3 text-sm font-black text-rose-600" />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Custo Unitário</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">R$</span>
                       <input required type="number" step="0.01" value={formData.unitPrice} onChange={e => setFormData({...formData, unitPrice: parseFloat(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-10 pr-4 py-3 text-sm font-black" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Local de Armazenamento</label>
                    <input required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Prateleira A1, Escritório..." className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-bold" />
                  </div>

                  {formData.type === 'asset' && (
                    <>
                      <div className="col-span-2 border-t border-zinc-100 pt-6">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 block">Especificações de Patrimônio</label>
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block">Número de Série</label>
                              <input value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className="w-full bg-amber-50/30 border border-amber-100 rounded-xl px-4 py-3 text-sm font-mono" />
                           </div>
                           <div>
                              <label className="text-[10px] font-black text-zinc-500 uppercase mb-2 block">Atribuído a (Responsável)</label>
                              <input value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})} className="w-full bg-amber-50/30 border border-amber-100 rounded-xl px-4 py-3 text-sm font-bold" />
                           </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button type="submit" className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-zinc-900/10 active:scale-[0.98] uppercase tracking-widest">
                  Confirmar Cadastro
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOVEMENT MODAL */}
      <AnimatePresence>
        {isMoveModalOpen && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
               initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
               className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 leading-tight">Movimentação de Estoque</h3>
                  <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-tighter">{selectedItem.name} ({selectedItem.sku})</p>
                </div>
                <button onClick={() => setIsMoveModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex items-center justify-between mb-8">
                <div className="text-center flex-1">
                   <p className="text-[10px] font-black text-zinc-400 uppercase">Saldo Atual</p>
                   <p className="text-2xl font-black text-zinc-900">{selectedItem.quantity}</p>
                </div>
                <div className="w-px h-8 bg-zinc-200 mx-4"></div>
                <div className="text-center flex-1">
                   <p className="text-[10px] font-black text-zinc-400 uppercase">Min. Segurança</p>
                   <p className="text-2xl font-black text-rose-500">{selectedItem.minQuantity}</p>
                </div>
              </div>

              <form onSubmit={handleMovement} className="space-y-6">
                <div>
                   <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Motivos da Movimentação</label>
                   <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'purchase', label: 'Compra/Reposição', icon: ArrowUpRight, color: 'text-emerald-500' },
                        { id: 'ticket_fulfillment', label: 'Saída para Ticket', icon: ArrowDownLeft, color: 'text-blue-500' },
                        { id: 'adjustment', label: 'Ajuste de Saldo', icon: Move, color: 'text-zinc-400' },
                        { id: 'disposal', label: 'Quebra/Descarte', icon: ArrowDownLeft, color: 'text-rose-500' }
                      ].map((reason) => (
                        <button 
                          key={reason.id} type="button"
                          onClick={() => setMoveData({...moveData, reason: reason.id as any})}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                            moveData.reason === reason.id ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-zinc-100 hover:border-zinc-300"
                          )}
                        >
                          <reason.icon className={cn("w-4 h-4", moveData.reason === reason.id ? "text-white" : reason.color)} />
                          <span className="text-[11px] font-black uppercase tracking-tighter">{reason.label}</span>
                        </button>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Quantidade</label>
                     <input required type="number" min="1" value={moveData.quantity} onChange={e => setMoveData({...moveData, quantity: parseInt(e.target.value)})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-lg font-black outline-none focus:ring-4 focus:ring-zinc-900/5 text-center" />
                   </div>
                   <div>
                     <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Cód Ticket (Opcional)</label>
                     <input value={moveData.ticketProtocol} onChange={e => setMoveData({...moveData, ticketProtocol: e.target.value})} placeholder="TCK-XXXX-XXXX" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-mono placeholder:text-zinc-300 focus:ring-4 focus:ring-zinc-900/5 outline-none" />
                   </div>
                </div>

                <button type="submit" className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-zinc-900/20 active:scale-[0.98] uppercase tracking-widest flex items-center justify-center gap-2">
                   {moveData.reason === 'purchase' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                   Efetivar Movimentação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

