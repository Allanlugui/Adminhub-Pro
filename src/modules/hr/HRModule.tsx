import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { Employee, UserRole } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { Users, UserPlus, Search, MoreHorizontal, Mail, Briefcase, X, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function HRModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createSystemAccess, setCreateSystemAccess] = useState(false);
  const [systemRole, setSystemRole] = useState<UserRole>('OPERATOR');
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    department: 'Administrativo',
    email: '',
    salary: 0,
    status: 'active' as const
  });

  useEffect(() => {
    const q = query(collection(db, 'employees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'employees'), {
        ...formData,
        hiredAt: serverTimestamp()
      });

      await logAudit('create', 'employees', docRef.id, { after: formData });

      // Integrate System Access creation if toggled
      if (createSystemAccess) {
        const userRef = doc(db, 'users', docRef.id); // Or use email as key or unique ID
        const userData = {
          uid: docRef.id,
          email: formData.email,
          displayName: formData.name,
          role: systemRole,
          status: 'active',
          mustChangePassword: true,
          createdAt: serverTimestamp()
        };
        await setDoc(userRef, userData);
        await logAudit('create', 'users', docRef.id, { after: userData });
      }

      // CONVERSA COM OUTROS SISTEMAS: Cria ticket de Onboarding automaticamente
      await addDoc(collection(db, 'tickets'), {
        title: `Onboarding: ${formData.name}`,
        description: `Preparar estação de trabalho e acessos para o novo colaborador do setor ${formData.department}. Access Level: ${createSystemAccess ? systemRole : 'None'}`,
        priority: 'high',
        category: 'HR',
        protocol: `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'open',
        requesterId: 'system',
        requesterName: 'RH System',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`Colaborador ${formData.name} registrado com sucesso!`);
      setIsModalOpen(false);
      setFormData({ name: '', role: '', department: 'Administrativo', email: '', salary: 0, status: 'active' });
      setCreateSystemAccess(false);
    } catch (error) {
      console.error("Erro ao adicionar:", error);
      toast.error('Erro ao registrar contratação.');
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    const employee = employees.find(e => e.id === id);
    if (!id || !confirm(`Deseja realmente desligar o colaborador ${name}? Esta ação será registrada no log de auditoria.`)) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'employees', id));
      
      await logAudit('delete', 'employees', id, { before: employee });
      toast.info(`Colaborador ${name} foi desligado.`);
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error('Ocorreu um erro ao remover o colaborador.');
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Recursos Humanos</h2>
          <p className="text-zinc-500">Gestão de talentos e estrutura organizacional.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
        >
          <UserPlus className="w-5 h-5" />
          <span className="font-semibold">Novo Colaborador</span>
        </button>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-zinc-900 leading-tight">Cadastrar Colaborador</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Nome Completo</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Email Corporativo</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Cargo</label>
                    <input required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Setor</label>
                    <select value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500/20 outline-none">
                      <option>Administrativo</option>
                      <option>Financeiro</option>
                      <option>TI</option>
                      <option>Logística</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl cursor-pointer hover:bg-indigo-100/50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={createSystemAccess}
                      onChange={(e) => setCreateSystemAccess(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-black text-indigo-900 uppercase tracking-tight">Ativar Acesso Administrativo</span>
                      </div>
                      <p className="text-[10px] text-indigo-600 font-medium">Habilitar login e permissões no sistema.</p>
                    </div>
                  </label>
                </div>

                <AnimatePresence>
                  {createSystemAccess && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nível de Acesso (RBAC)</label>
                        <select 
                          value={systemRole}
                          onChange={(e) => setSystemRole(e.target.value as UserRole)}
                          className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          <option value="OPERATOR">Operator (Operação)</option>
                          <option value="MANAGER">Manager (Gestor)</option>
                          <option value="ADMIN">Admin (Sistema)</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button type="submit" className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-zinc-800 transition-all shadow-lg active:scale-95">
                  Confirmar Contratação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou setor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-zinc-500">Filtrar por Status:</span>
            <select className="bg-white border border-zinc-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
              <option>Todos</option>
              <option>Ativos</option>
              <option>Férias</option>
              <option>Desligados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Colaborador</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cargo & Setor</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEmployees.map((employee, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={employee.id || employee.name} 
                  className="hover:bg-zinc-50/80 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 leading-none">{employee.name}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span className="text-xs text-zinc-500">{employee.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-3 h-3 text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-700">{employee.role}</span>
                      </div>
                      <span className="text-xs text-zinc-500 ml-4">{employee.department}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                      employee.status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}>
                      {employee.status === 'active' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => employee.id && handleDeleteEmployee(employee.id, employee.name)}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
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
