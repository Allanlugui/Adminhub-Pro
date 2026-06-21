import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, setDoc, doc, orderBy, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { Employee, UserRole } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { 
  Users, UserPlus, Search, Mail, Briefcase, X, 
  ShieldCheck, LayoutGrid, CalendarRange, BarChart3, 
  Network, Filter, MoreVertical, Plus, ArrowRight,
  TrendingDown, TrendingUp, UserMinus, Phone, MapPin, 
  Trash2, ClipboardCheck
} from 'lucide-react';
import { cn, formatCurrency } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import EmployeeDetails from './components/EmployeeDetails';
import VacationManager from './components/VacationManager';
import OnboardingFlow from './components/OnboardingFlow';

export default function HRModule() {
  const [activeTab, setActiveTab] = useState<'employees' | 'onboarding' | 'vacation' | 'performance' | 'org'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOffboardingModalOpen, setIsOffboardingModalOpen] = useState(false);
  const [offboardingEmployeeId, setOffboardingEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Stats for the header
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'on_leave').length,
    onboarding: employees.filter(e => e.status === 'onboarding').length,
  };

  const handleOffboarding = async () => {
    const emp = employees.find(e => e.id === offboardingEmployeeId);
    if (!emp || !offboardingEmployeeId) return;

    if (!confirm(`Confirmar DESLIGAMENTO de ${emp.name}? Esta ação irá:\n1. Revogar acessos ao sistema\n2. Criar ticket para devolução de ativos\n3. Registrar log de auditoria imutável`)) return;

    try {
      await updateDoc(doc(db, 'employees', offboardingEmployeeId), {
        status: 'terminated',
        terminatedAt: serverTimestamp(),
        history: [
          ...(emp.history || []),
          {
            date: Timestamp.now(),
            event: 'Desligamento (Offboarding)',
            description: 'Colaborador desligado da organização. Fluxo de encerramento concluído.'
          }
        ]
      });

      // Revoke user access if exists
      const userDoc = await getDoc(doc(db, 'users', offboardingEmployeeId));
      if (userDoc.exists()) {
        await updateDoc(doc(db, 'users', offboardingEmployeeId), { status: 'disabled' });
        await logAudit('status_change', 'users', offboardingEmployeeId, { 
          before: { status: 'active' }, 
          after: { status: 'disabled' } 
        });
      }

      await logAudit('status_change', 'employees', offboardingEmployeeId, { 
        before: { status: emp.status }, 
        after: { status: 'terminated' } 
      });

      // Create Ticket for Asset Collection
      await addDoc(collection(db, 'tickets'), {
        title: `Asset Return: ${emp.name}`,
        description: `Coletar ativos (notebook, periféricos) do colaborador desligado (${emp.departmentName}).`,
        priority: 'critical',
        category: 'IT',
        protocol: `TCK-OFF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'open',
        requesterId: 'system',
        requesterName: 'RH System',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.warning(`Offboarding de ${emp.name} concluído.`);
      setIsOffboardingModalOpen(false);
      setOffboardingEmployeeId('');
    } catch (error: any) {
      console.error("[HR Error]", error);
      toast.error('Erro no processo de desligamento: ' + (error?.message || error?.toString() || 'Erro desconhecido'));
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateEmployee = async (formData: any) => {
    try {
      const docRef = await addDoc(collection(db, 'employees'), {
        ...formData,
        status: 'onboarding',
        hiredAt: serverTimestamp(),
        performanceScore: 0,
        history: [{
          date: Timestamp.now(),
          event: 'Onboarding Iniciado',
          description: 'Colaborador registrado no sistema para início do processo de admissão.'
        }]
      });

      // Sincronização Bidirecional: Disparo para o Nexus
      try {
        await fetch('/api/integration/hr/nexus-outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            documentId: formData.documentId,
            role: formData.role
          })
        });
        toast.info('Dados sincronizados com sucesso no ERP Nexus.');
      } catch (syncError: any) {
        console.error('Falha na sincronização Nexus:', syncError);
        toast.error('Colaborador criado, mas falha na sincronização com Nexus. Detalhes: ' + (syncError?.message || syncError?.toString() || 'Erro de conexão'));
      }

      await logAudit('create', 'employees', docRef.id, { after: formData });

      // Create Ticket for IT Support
      await addDoc(collection(db, 'tickets'), {
        title: `Onboarding TI: ${formData.name}`,
        description: `Preparar estação e credenciais para o novo colaborador do setor ${formData.departmentName}.`,
        priority: 'high',
        category: 'IT',
        protocol: `TCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'open',
        requesterId: 'system',
        requesterName: 'RH System',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success(`${formData.name} entrou em onboarding!`);
      setIsCreateModalOpen(false);
    } catch (error: any) {
      console.error("[HR Error]", error);
      toast.error('Erro ao registrar colaborador. Detalhes: ' + (error?.message || error?.toString() || 'Erro interno no banco/servidor'));
    }
  };

  const tabs = [
    { id: 'employees', label: 'Colaboradores', icon: Users },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'vacation', label: 'Férias & Licenças', icon: CalendarRange },
    { id: 'performance', label: 'Gestão de Desempenho', icon: BarChart3 },
    { id: 'org', label: 'Organograma', icon: Network },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header with KPI cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            Recursos Humanos & Gestão de Talentos
          </h2>
          <p className="text-zinc-500 font-medium">Gestão integrada do ciclo de vida do colaborador para a estrutura organizacional.</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={() => setIsCreateModalOpen(true)}
             className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2 active:scale-95"
           >
             <UserPlus className="w-4 h-4" /> Novo Colaborador
           </button>
           <button 
             onClick={() => setIsOffboardingModalOpen(true)}
             className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-zinc-900/10 flex items-center gap-2 active:scale-95"
           >
             <UserMinus className="w-4 h-4" /> Iniciar Offboarding
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Headcount', value: stats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Colaboradores Ativos', value: stats.active, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Em Afastamento', value: stats.onLeave, icon: CalendarRange, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Taxa de Retenção', value: '98.5%', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-zinc-900 leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex border-b border-zinc-100 bg-zinc-50/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0",
                activeTab === tab.id ? "border-indigo-600 text-indigo-600 bg-white" : "border-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'employees' && (
              <motion.div 
                key="employees" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex gap-6 h-full min-h-[600px]"
              >
                {/* Table Section */}
                <div className={cn(
                  "bg-white rounded-[2rem] shadow-sm border border-zinc-200 flex flex-col overflow-hidden transition-all duration-500",
                  selectedEmployee ? "flex-1" : "w-full"
                )}>
                  <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
                    <div className="relative w-72">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                      <input 
                        type="text" 
                        placeholder="Buscar por nome ou setor..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                      />
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Status:</span>
                      <select className="text-xs border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white font-bold text-zinc-700">
                        <option>Todos</option>
                        <option>Ativos</option>
                        <option>Em Férias</option>
                        <option>Desligados</option>
                      </select>
                      <button className="p-2 border border-zinc-200 rounded-lg text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition">
                        <Filter className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-wider bg-zinc-50 border-b border-zinc-100">
                          <th className="px-6 py-4">Colaborador</th>
                          <th className="px-6 py-4">Departamento</th>
                          <th className="px-6 py-4">Admissão</th>
                          <th className="px-6 py-4">Última Avaliação</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50">
                        {employees.filter(e => 
                          e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          e.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          e.departmentName.toLowerCase().includes(searchTerm.toLowerCase())
                        ).map((employee) => (
                          <tr 
                            key={employee.id} 
                            className={cn(
                              "transition-all cursor-pointer group",
                              selectedEmployee?.id === employee.id ? "bg-indigo-50/50 hover:bg-indigo-50/80" : "hover:bg-zinc-50"
                            )}
                            onClick={() => setSelectedEmployee(employee)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center font-bold mr-3 border transition-all",
                                  selectedEmployee?.id === employee.id ? "bg-indigo-600 text-white border-indigo-600 scale-110 shadow-lg shadow-indigo-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                                )}>
                                  {employee.name.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-zinc-900 text-sm">{employee.name}</p>
                                  <p className="text-zinc-400 text-[10px] font-medium tracking-tight">{employee.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-zinc-600 text-sm font-medium">{employee.departmentName}</td>
                            <td className="px-6 py-4 text-zinc-600 text-sm font-medium">
                              {employee.hiredAt?.toDate ? employee.hiredAt.toDate().toLocaleDateString('pt-BR') : '---'}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-zinc-600 text-sm font-medium">17/06/2026</p>
                              <p className="text-zinc-400 text-[10px] font-bold">23:32</p>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
                                employee.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                employee.status === 'on_leave' ? "bg-amber-50 text-amber-700 border-amber-100" :
                                "bg-zinc-100 text-zinc-500 border-zinc-200"
                              )}>
                                {employee.status === 'active' ? 'Ativo' : 
                                 employee.status === 'on_leave' ? 'Afastado' : 
                                 employee.status === 'onboarding' ? 'Onboarding' : 'Desligado'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button className="text-zinc-400 hover:text-zinc-900 transition-colors p-1">
                                <ArrowRight className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Profile Widget Sidebar */}
                <AnimatePresence>
                  {selectedEmployee && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20, width: 0 }}
                      animate={{ opacity: 1, x: 0, width: '24rem' }}
                      exit={{ opacity: 0, x: 20, width: 0 }}
                      className="overflow-hidden"
                    >
                      <EmployeeDetails 
                        employee={selectedEmployee} 
                        onClose={() => setSelectedEmployee(null)} 
                        variant="widget"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'vacation' && <VacationManager />}

            {activeTab === 'onboarding' && (
              <div className="py-24 text-center">
                 <UserPlus className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
                 <h4 className="text-xl font-black text-zinc-900 mb-2">Módulo em Hypercare</h4>
                 <p className="text-zinc-500 max-w-sm mx-auto font-medium">O fluxo de onboarding automatizado está sendo homologado para os 30 usuários iniciais.</p>
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="py-24 text-center">
                 <BarChart3 className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
                 <h4 className="text-xl font-black text-zinc-900 mb-2">Ciclo de Desempenho Indisponível</h4>
                 <p className="text-zinc-500 max-w-sm mx-auto font-medium">As avaliações trimestrais estarão disponíveis a partir de Julho/2026.</p>
              </div>
            )}

            {activeTab === 'org' && (
              <div className="py-24 text-center">
                 <Network className="w-16 h-16 text-zinc-100 mx-auto mb-4" />
                 <h4 className="text-xl font-black text-zinc-900 mb-2">Estrutura Hieraárquica</h4>
                 <p className="text-zinc-500 max-w-sm mx-auto font-medium">O organograma dinâmico está sendo populado a partir das relações de reporte.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Onboarding Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl relative z-10 overflow-hidden border border-zinc-200"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                       <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="font-black text-zinc-900 leading-tight">Novo Colaborador</h3>
                       <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Processo de Admissão Enterprise</p>
                    </div>
                 </div>
                 <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400">
                    <X className="w-6 h-6" />
                 </button>
              </div>
              <OnboardingFlow onComplete={handleCreateEmployee} onCancel={() => setIsCreateModalOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Offboarding Modal */}
      <AnimatePresence>
        {isOffboardingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOffboardingModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              className="bg-white rounded-[32px] w-full max-w-md shadow-2xl relative z-10 overflow-hidden border border-zinc-200"
            >
              <div className="p-8 border-b border-zinc-100 bg-rose-50/50">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-rose-600 rounded-xl flex items-center justify-center text-white">
                       <UserMinus className="w-5 h-5" />
                    </div>
                    <div>
                       <h3 className="font-black text-rose-900 leading-tight">Fluxo de Offboarding</h3>
                       <p className="text-[10px] text-rose-600 font-black uppercase tracking-widest">Desligamento Enterprise</p>
                    </div>
                 </div>
              </div>
              
              <div className="p-8 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Selecionar Colaborador</label>
                    <select 
                      value={offboardingEmployeeId}
                      onChange={e => setOffboardingEmployeeId(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-rose-500/5 outline-none"
                    >
                       <option value="">Selecione para desligamento...</option>
                       {employees.filter(e => e.status !== 'terminated').map(emp => (
                         <option key={emp.id} value={emp.id}>{emp.name} ({emp.departmentName})</option>
                       ))}
                    </select>
                 </div>

                 <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase tracking-tight">
                       Esta ação é irreversível. O colaborador terá seu acesso revogado imediatamente e as equipes de TI/Logística serão notificadas via Ticket para recolhimento de ativos.
                    </p>
                 </div>

                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => setIsOffboardingModalOpen(false)}
                      className="py-4 border border-zinc-200 text-zinc-500 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-zinc-50"
                    >
                       Cancelar
                    </button>
                    <button 
                      onClick={handleOffboarding}
                      disabled={!offboardingEmployeeId}
                      className="py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-rose-700 disabled:bg-rose-200 shadow-xl shadow-rose-600/20"
                    >
                       Confirmar Desligamento
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Actions (Floating or Sidebar extension can be added here) */}
    </div>
  );
}
