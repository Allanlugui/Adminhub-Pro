import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, where, orderBy } from 'firebase/firestore';
import { LeaveRequest, Employee } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Plus, Filter, User, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/src/lib/utils';

export default function VacationManager() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'vacation' as const,
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'leaveRequests'), orderBy('requestedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
      setLoading(false);
    });

    const qEmp = query(collection(db, 'employees'), where('status', '==', 'active'));
    onSnapshot(qEmp, (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
    });

    return () => unsubscribe();
  }, []);

  const activeLeavesCount = requests.filter(r => {
    if (r.status !== 'approved') return false;
    const end = r.endDate.toDate ? r.endDate.toDate() : new Date(r.endDate);
    const start = r.startDate.toDate ? r.startDate.toDate() : new Date(r.startDate);
    const now = new Date();
    return now >= start && now <= end;
  }).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedEmp = employees.find(emp => emp.id === formData.employeeId);
    if (!selectedEmp) return;

    try {
      const newRequest = {
        ...formData,
        employeeName: selectedEmp.name,
        status: 'pending',
        requestedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'leaveRequests'), newRequest);
      await logAudit('create', 'hr_leaves', docRef.id, { after: newRequest });
      
      toast.success('Solicitação de ausência registrada!');
      setIsModalOpen(false);
      setFormData({ employeeId: '', type: 'vacation', startDate: '', endDate: '', reason: '' });
    } catch (error) {
      toast.error('Erro ao registrar solicitação.');
    }
  };

  const handleReview = async (request: LeaveRequest, status: 'approved' | 'rejected') => {
    const user = auth.currentUser;
    if (!request.id) return;

    try {
      await updateDoc(doc(db, 'leaveRequests', request.id), {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: user?.displayName || 'Admin'
      });

      await logAudit('status_change', 'hr_leaves', request.id, { 
        before: { status: request.status }, 
        after: { status } 
      });

      toast.success(`Solicitação de ${request.employeeName} ${status === 'approved' ? 'aprovada' : 'rejeitada'}.`);
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
      case 'rejected': return <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejeitado</span>;
      case 'pending': return <span className="bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1"><Clock className="w-3 h-3" /> Pendente</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl border border-zinc-200">
            <Calendar className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 leading-tight">Painel de Férias & Ausências</h3>
            <p className="text-sm text-zinc-500 font-medium">Fluxo centralizado de solicitações e aprovações.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Aguardando Revisão</p>
           </div>
           <p className="text-3xl font-black text-zinc-900">{requests.filter(r => r.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Aprovados (Este Mês)</p>
           </div>
           <p className="text-3xl font-black text-zinc-900">{requests.filter(r => r.status === 'approved').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Afastamentos Ativos</p>
           </div>
           <p className="text-3xl font-black text-zinc-900">{activeLeavesCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
           <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input type="text" placeholder="Filtrar por colaborador..." className="w-full bg-white border border-zinc-200 rounded-xl py-2 pl-10 pr-4 text-sm outline-none" />
           </div>
           <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 bg-white hover:bg-zinc-50">
                 <Filter className="w-3.5 h-3.5" /> Filtrar
              </button>
           </div>
        </div>
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Colaborador</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Período</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipo & Motivo</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-sm">
              {requests.map((request, idx) => (
                <motion.tr 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}
                  key={request.id} className="group hover:bg-zinc-50/50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center font-bold text-zinc-600 text-[10px]">
                          {request.employeeName.charAt(0)}
                       </div>
                       <p className="font-bold text-zinc-900 leading-tight">{request.employeeName}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="font-bold text-zinc-700">
                          {format(request.startDate.toDate ? request.startDate.toDate() : new Date(request.startDate), 'dd/MM/yy')} → {format(request.endDate.toDate ? request.endDate.toDate() : new Date(request.endDate), 'dd/MM/yy')}
                       </span>
                       <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">15 Dias Solicitados</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-indigo-600 uppercase mb-1">{request.type === 'vacation' ? 'Férias' : 'Ausência'}</span>
                       <span className="text-xs text-zinc-500 font-medium truncate max-w-[200px]">{request.reason}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {request.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleReview(request, 'approved')}
                          className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleReview(request, 'rejected')}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">
                        Revisto por {request.reviewedBy}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-black text-zinc-900 leading-tight">Nova Solicitação</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">Ausência ou Férias</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Colaborador</label>
                    <select required value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all">
                       <option value="">Selecione o profissional...</option>
                       {employees.map(emp => (
                         <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                       ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Tipo</label>
                      <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all">
                        <option value="vacation">Férias</option>
                        <option value="sick_leave">Atestado Médico</option>
                        <option value="other">Outros</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Início</label>
                      <input required type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Término</label>
                      <input required type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all" />
                    </div>
                 </div>

                 <div>
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2 block">Justificativa / Motivo</label>
                    <textarea required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} rows={3} placeholder="Descreva brevemente o motivo da ausência..." className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all resize-none" />
                 </div>

                 <button type="submit" className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all shadow-xl shadow-zinc-900/10 uppercase tracking-widest text-xs">
                    Confirmar Envio para Revisão
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
