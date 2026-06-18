import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { UserProfile, UserRole } from '@/src/types';
import { logAudit } from '@/src/lib/audit';
import { 
  Shield, UserPlus, Search, UserCheck, UserMinus, ShieldAlert, 
  Key, MoreHorizontal, Download, Smartphone, LayoutList, 
  ChevronRight, ArrowRight, Zap, History, Lock,
  FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import { cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import SecurityWidget from './components/SecurityWidget';

export default function UsersModule() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    role: 'OPERATOR' as UserRole
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile));
      setUsers(usersData);
      setLoading(false);

      if (selectedUser) {
        const updated = usersData.find(u => u.uid === selectedUser.uid);
        if (updated) setSelectedUser(updated);
      }
    });
    return () => unsubscribe();
  }, [selectedUser?.uid]);

  const handleExportMatrix = () => {
    const data = users.map(u => ({
      Nome: u.displayName,
      Email: u.email,
      Role: u.role,
      Status: u.status,
      MFA: u.mfaEnabled ? 'Ativo' : 'Inativo',
      'Financeiro View': u.permissions?.finance?.view ? 'Sim' : 'Não',
      'Financeiro Approve': u.permissions?.finance?.approve ? 'Sim' : 'Não',
      'Estoque Adjust': u.permissions?.inventory?.adjust ? 'Sim' : 'Não',
      'Criado em': u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : '---'
    }));
    const csv = convertToCSV(data);
    downloadCSV(csv, `matriz-acessos-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Matriz de acessos exportada para auditoria.');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Nota: No Firebase real, a criação do registro Auth seria via Admin SDK ou convite por email.
      // Aqui simulamos a criação do perfil que o sistema usará para RBAC.
      const userRef = doc(collection(db, 'users'));
      const newUser = {
        uid: userRef.id,
        email: formData.email,
        displayName: formData.displayName,
        role: formData.role,
        status: 'active',
        mustChangePassword: true,
        createdAt: serverTimestamp()
      };

      await setDoc(userRef, newUser);
      await logAudit('create', 'users', userRef.id, { after: newUser });

      toast.success(`Convite gerado para ${formData.displayName}.`);
      setIsModalOpen(false);
      setFormData({ email: '', displayName: '', role: 'OPERATOR' });
    } catch (error) {
      toast.error('Erro ao processar onboarding.');
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    if (!confirm(`Deseja realmente ${newStatus === 'active' ? 'ativar' : 'suspender'} o acesso de ${user.displayName}?`)) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), { status: newStatus });
      await logAudit('status_change', 'users', user.uid, { 
        before: { status: user.status }, 
        after: { status: newStatus } 
      });
      toast.info(`Acesso de ${user.displayName} ${newStatus === 'active' ? 'restabelecido' : 'suspenso'}.`);
    } catch (error) {
      toast.error('Falha ao alterar status de acesso.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-600" />
            Governance & Access (RBAC)
          </h2>
          <p className="text-zinc-500 mt-1 font-medium text-sm">Diretório de Segurança Enterprise • Bit-Audit Ativo</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportMatrix}
            className="bg-white text-zinc-600 border border-zinc-200 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-zinc-50 transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Matriz de Acessos
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-zinc-900 text-white px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 shadow-xl shadow-zinc-900/10"
          >
            <UserPlus className="w-4 h-4" />
            Novo Onboarding
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome, email ou nível de acesso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
      </div>

      {/* Main Container: Split Master-Detail */}
      <div className={cn(
        "flex gap-6 min-h-0",
        selectedUser ? "grid grid-cols-1 xl:grid-cols-2" : "grid grid-cols-1"
      )}>
        {/* Left Side: Master Directory */}
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden h-fit">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Usuário / ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Level</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">MFA</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right leading-none">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredUsers.map((user) => (
                <tr 
                  key={user.uid} 
                  onClick={() => setSelectedUser(user)}
                  className={cn(
                    "hover:bg-zinc-50/50 transition-all cursor-pointer group", 
                    user.status === 'disabled' && "opacity-40 grayscale",
                    selectedUser?.uid === user.uid && "bg-indigo-50/30"
                  )}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-lg shadow-zinc-900/10 group-hover:scale-105 transition-transform">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-zinc-900 uppercase tracking-tight">{user.displayName}</p>
                        <p className="text-[10px] text-zinc-500 font-bold">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[9px] font-black uppercase border tracking-widest",
                      user.role === 'ADMIN' ? "bg-red-50 text-red-600 border-red-100" :
                      user.role === 'MANAGER' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-blue-50 text-blue-600 border-blue-100"
                    )}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", user.status === 'active' ? "bg-emerald-500" : "bg-red-500")}></div>
                      <span className="text-[10px] font-black text-zinc-700 uppercase tracking-tight">{user.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={cn(
                      "flex items-center gap-1",
                      user.mfaEnabled ? "text-emerald-600" : "text-zinc-300"
                    )}>
                      <Smartphone className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-black uppercase">{user.mfaEnabled ? 'On' : 'Off'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <ChevronRight className={cn(
                      "w-5 h-5 text-zinc-300 ml-auto transition-transform",
                      selectedUser?.uid === user.uid && "translate-x-1 text-indigo-600"
                    )} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="p-20 text-center bg-zinc-50/30">
               <ShieldAlert className="w-10 h-10 text-zinc-200 mx-auto mb-4" />
               <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhum registro de acesso compatível</p>
            </div>
          )}
        </div>

        {/* Right Side: Security Detail Widget */}
        <AnimatePresence mode="wait">
          {selectedUser && (
            <motion.div 
               initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
               className="h-full"
            >
               <SecurityWidget 
                 user={selectedUser} 
                 onClose={() => setSelectedUser(null)} 
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Onboarding */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative z-10 overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white rotate-3">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900">Onboarding de Usuário</h3>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Adicionar à Matriz RBAC</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    required 
                    type="text"
                    value={formData.displayName}
                    onChange={e => setFormData({...formData, displayName: e.target.value})}
                    placeholder="Ex: João da Silva"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                  <input 
                    required 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="joao@empresa.com"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nível de Autoridade (Role)</label>
                  <select 
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="OPERATOR">Operator (Visualização/Operação Básica)</option>
                    <option value="MANAGER">Manager (Gestor de Departamento)</option>
                    <option value="ADMIN">Admin (Super-usuário Enterprise)</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 border border-zinc-200 text-zinc-600 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Gerar Acesso
                  </button>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                    A criação gerará um log imutável no AuditEngine. Senha padrão será solicitada no primeiro login.
                  </p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
