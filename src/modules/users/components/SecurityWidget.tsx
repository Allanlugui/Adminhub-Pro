import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Shield, Lock, Monitor, History, Settings,
  Check, AlertCircle, Terminal, Smartphone,
  Globe, UserMinus, Key, RefreshCw, Zap,
  CheckCircle2, Info
} from 'lucide-react';
import { UserProfile, AuditLog, PermissionMatrix } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { db } from '@/src/lib/firebase';
import { 
  collection, query, where, orderBy, onSnapshot, 
  updateDoc, doc, limit 
} from 'firebase/firestore';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface SecurityWidgetProps {
  user: UserProfile;
  onClose: () => void;
}

export default function SecurityWidget({ user, onClose }: SecurityWidgetProps) {
  const [activeTab, setActiveTab] = useState<'permissions' | 'sessions' | 'policies' | 'audit'>('permissions');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!user.uid) return;

    const q = query(
      collection(db, 'auditLogs'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    return () => unsubscribe();
  }, [user.uid]);

  const updatePermission = async (module: keyof PermissionMatrix, action: string, value: boolean) => {
    setIsUpdating(true);
    try {
      const newPermissions = {
        ...user.permissions,
        [module]: {
          ...(user.permissions?.[module] || {}),
          [action]: value
        }
      };

      await updateDoc(doc(db, 'users', user.uid), { permissions: newPermissions });
      toast.success('Matriz de permissões atualizada.');
    } catch (error) {
      toast.error('Falha ao atualizar permissões.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleForceReset = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { mustChangePassword: true });
      toast.info('Reset de senha obrigatório ativado.');
    } catch (error) {
      toast.error('Erro ao acionar reset de senha.');
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm('Deseja revogar todas as sessões ativas deste usuário?')) return;
    try {
      // In a real environment with Firebase Admin, we'd revoke tokens.
      // Here we simulate by flagging the account for re-auth or logout.
      await updateDoc(doc(db, 'users', user.uid), { forceLogout: true });
      toast.success('Kill Switch acionado. Sessões revogadas.');
    } catch (error) {
      toast.error('Erro ao revogar sessões.');
    }
  };

  const tabs = [
    { id: 'permissions', label: 'Permissões', icon: Shield },
    { id: 'sessions', label: 'Sessões', icon: Monitor },
    { id: 'policies', label: 'Políticas', icon: Lock },
    { id: 'audit', label: 'Audit Log', icon: History },
  ];

  return (
    <div className="bg-white flex flex-col h-full rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-zinc-900/10">
               <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Security Dashboard</p>
              <h3 className="text-xl font-black text-zinc-900 tracking-tight">{user.displayName}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-200 rounded-full text-zinc-400 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex space-x-6 mt-8 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 relative whitespace-nowrap",
                activeTab === tab.id ? "text-indigo-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabSecurity" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'permissions' && (
            <motion.div 
               key="permissions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-8"
            >
               <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <Zap className="w-5 h-5 text-indigo-600" />
                  <p className="text-[11px] font-bold text-indigo-900 leading-relaxed uppercase tracking-tight">
                    Modificações na matriz RBAC são aplicadas em tempo real na sessão do usuário.
                  </p>
               </div>

               <div className="space-y-6">
                  {/* Finance */}
                  <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Módulo Financeiro</h4>
                        <CheckCircle2 className="w-4 h-4 text-zinc-300" />
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        {['view', 'approve', 'delete'].map(action => (
                           <button 
                              key={action}
                              onClick={() => updatePermission('finance', action, !((user.permissions?.finance as any)?.[action]))}
                              disabled={isUpdating}
                              className={cn(
                                "py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-center",
                                (user.permissions?.finance as any)?.[action] 
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" 
                                : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                              )}
                           >
                              {action}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Inventory */}
                  <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Módulo Estoque / Assets</h4>
                        <CheckCircle2 className="w-4 h-4 text-zinc-300" />
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        {['view', 'adjust', 'delete'].map(action => (
                           <button 
                              key={action}
                              onClick={() => updatePermission('inventory', action, !((user.permissions?.inventory as any)?.[action]))}
                              disabled={isUpdating}
                              className={cn(
                                "py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-center",
                                (user.permissions?.inventory as any)?.[action] 
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" 
                                : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                              )}
                           >
                              {action}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* HR */}
                  <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Recursos Humanos</h4>
                        <CheckCircle2 className="w-4 h-4 text-zinc-300" />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        {['view', 'manage'].map(action => (
                           <button 
                              key={action}
                              onClick={() => updatePermission('hr', action, !((user.permissions?.hr as any)?.[action]))}
                              disabled={isUpdating}
                              className={cn(
                                "py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-center",
                                (user.permissions?.hr as any)?.[action] 
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" 
                                : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                              )}
                           >
                              {action}
                           </button>
                        ))}
                     </div>
                  </div>

                  {/* Tickets */}
                  <div className="bg-zinc-50 rounded-2xl p-6 border border-zinc-100">
                     <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Central de Chamados</h4>
                        <CheckCircle2 className="w-4 h-4 text-zinc-300" />
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        {['view', 'resolve', 'admin'].map(action => (
                           <button 
                              key={action}
                              onClick={() => updatePermission('tickets', action, !((user.permissions?.tickets as any)?.[action]))}
                              disabled={isUpdating}
                              className={cn(
                                "py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-center",
                                (user.permissions?.tickets as any)?.[action] 
                                ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" 
                                : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
                              )}
                           >
                              {action}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'sessions' && (
            <motion.div 
               key="sessions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-6"
            >
               <div className="bg-zinc-900 rounded-3xl p-6 text-white overflow-hidden relative">
                  <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/5 rounded-full blur-xl" />
                  <div className="relative z-10">
                     <p className="text-[8px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-2">Sessão Mais Recente</p>
                     <div className="flex items-center gap-4 mb-6">
                        <Globe className="w-10 h-10 text-indigo-400" />
                        <div>
                           <p className="text-xl font-black">{user.lastIp || '192.168.0.1'}</p>
                           <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Acesso de {user.lastLogin ? format(user.lastLogin.toDate(), 'dd/MM/yyyy HH:mm') : 'N/A'}</p>
                        </div>
                     </div>
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                           <Smartphone className="w-3.5 h-3.5 text-zinc-400" />
                           <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">Device Signature</span>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-300 break-all">{user.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit...'}</p>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <button 
                     onClick={handleKillSwitch}
                     className="w-full flex items-center justify-between p-5 bg-red-50 border border-red-100 rounded-2xl group transition-all hover:bg-red-100 active:scale-95"
                  >
                     <div className="flex items-center gap-3">
                        <UserMinus className="w-5 h-5 text-red-600" />
                        <div className="text-left">
                           <p className="text-[10px] font-black text-red-900 uppercase tracking-widest mb-1">Revogar Acessos</p>
                           <p className="text-xs text-red-700 font-medium">Kill Switch - Desloga de todos dispositivos</p>
                        </div>
                     </div>
                     <Zap className="w-4 h-4 text-red-600" />
                  </button>

                  <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-2xl">
                     <div className="flex items-center gap-2 mb-4">
                        <Terminal className="w-4 h-4 text-zinc-400" />
                        <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Endpoints Detectados</h4>
                     </div>
                     <div className="space-y-3">
                        {[
                          { ip: '187.12.33.2', loc: 'São Paulo, BR', time: 'Há 2 horas' },
                          { ip: '200.22.9.144', loc: 'Curitiba, BR', time: 'Há 5 dias' }
                        ].map((s, i) => (
                           <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-200 last:border-0">
                              <div>
                                 <p className="text-[10px] font-black text-zinc-900 uppercase">{s.ip}</p>
                                 <p className="text-[9px] text-zinc-500 font-bold uppercase">{s.loc}</p>
                              </div>
                              <span className="text-[8px] font-black text-zinc-400 uppercase">{s.time}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'policies' && (
            <motion.div 
               key="policies" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-6"
            >
               <div className="p-6 border border-zinc-100 rounded-3xl bg-zinc-50">
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                     <SecurityWidgetPropsIcon icon={Settings} /> Account Enforcement
                  </h4>
                  <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-2xl">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-amber-50 rounded-lg">
                              <Key className="w-4 h-4 text-amber-600" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-zinc-900 uppercase">Redefinição de Senha</p>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase">Forçar troca no próximo login</p>
                           </div>
                        </div>
                        <button 
                           onClick={handleForceReset}
                           className={cn(
                             "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                             user.mustChangePassword ? "bg-amber-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                           )}
                        >
                           {user.mustChangePassword ? 'Ativado' : 'Acionar'}
                        </button>
                     </div>

                     <div className="flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-2xl">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-indigo-50 rounded-lg">
                              <Smartphone className="w-4 h-4 text-indigo-600" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-zinc-900 uppercase">Autenticação MFA</p>
                              <p className="text-[9px] text-zinc-500 font-bold uppercase">Multi-Factor Authentication</p>
                           </div>
                        </div>
                        <button 
                           onClick={async () => {
                             await updateDoc(doc(db, 'users', user.uid), { mfaEnabled: !user.mfaEnabled });
                             toast.success(`MFA ${!user.mfaEnabled ? 'Ativado' : 'Desativado'}`);
                           }}
                           className={cn(
                             "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                             user.mfaEnabled ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                           )}
                        >
                           {user.mfaEnabled ? 'Ativo' : 'Inativo'}
                        </button>
                     </div>
                  </div>
               </div>

               <div className="p-6 bg-zinc-900 rounded-3xl text-white">
                  <div className="flex items-center gap-2 mb-4">
                     <AlertCircle className="w-4 h-4 text-amber-500" />
                     <h4 className="text-[10px] font-black text-white/50 uppercase tracking-widest">Data Retention & Compliance</h4>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-zinc-300">
                     Este usuário está vinculado a registros fiscais e de RH ativos. A exclusão definitiva não é permitida pelo workflow corporativo. Utilize a suspensão de acesso para interromper sessões.
                  </p>
               </div>
            </motion.div>
          )}

          {activeTab === 'audit' && (
            <motion.div 
               key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
               className="space-y-4"
            >
               <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Histórico de Segurança Crítico</h4>
               <div className="space-y-3">
                  {auditLogs.length === 0 && (
                     <div className="p-6 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sem logs recentes</p>
                     </div>
                  )}
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex gap-4 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl items-start transition-all hover:bg-white hover:border-indigo-100 hover:shadow-sm">
                       <div className={cn(
                         "p-2 rounded-xl shrink-0 mt-1",
                         log.action === 'delete' ? "bg-red-50 text-red-600" :
                         log.action === 'create' ? "bg-emerald-50 text-emerald-600" :
                         "bg-white text-zinc-400 border border-zinc-100"
                       )}>
                          <SecurityWidgetPropsIcon icon={log.action === 'status_change' ? Zap : History} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-zinc-900 uppercase tracking-tight leading-tight mb-1">
                             {log.action.replace('_', ' ')} • <span className="text-zinc-500">{log.resource}</span>
                          </p>
                          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                             {log.timestamp ? format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss') : '---'}
                          </p>
                          <div className="bg-white/50 p-2 rounded-lg border border-zinc-200">
                             <p className="text-[9px] font-mono text-zinc-600 line-clamp-1">{JSON.stringify(log.changes || log.resourceId)}</p>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Actions */}
      <div className="p-8 bg-zinc-50 border-t border-zinc-100">
         <button 
           onClick={handleForceReset}
           className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 transition-all active:scale-95 flex items-center justify-center gap-2"
         >
            <RefreshCw className="w-4 h-4" /> Reciclar Credenciais
         </button>
         <div className="mt-4 flex items-center justify-center gap-2">
            <Info className="w-3.5 h-3.5 text-zinc-300" />
            <span className="text-[8px] font-black uppercase text-zinc-400 tracking-widest">Relatório de Compliance Bit-Audit V4.2</span>
         </div>
      </div>
    </div>
  );
}

function SecurityWidgetPropsIcon({ icon: Icon }: { icon: any }) {
  return <Icon className="w-4 h-4" />;
}
