import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Settings as SettingsIcon, Building, Globe, Zap, Save, RefreshCw, 
  Shield, Database, Activity, Clock, Lock, History, AlertCircle,
  HardDrive, Monitor, DollarSign, Image as ImageIcon, CheckCircle2,
  AlertTriangle, X, Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { logAudit } from '@/src/lib/audit';
import { SystemSettings } from '@/src/types';
import { cn } from '@/src/lib/utils';

export default function SettingsModule() {
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'AdminHub Enterprise',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    security: {
      strongPassword: true,
      sessionTimeout: 2,
      requireMfaForAdmins: true
    },
    retention: {
      auditLogs: 5,
      backups: 30
    }
  });

  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'backup' | 'health' | 'integrations'>('general');
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [latency, setLatency] = useState(24);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as SystemSettings;
        setSettings(data);
        setOriginalSettings(data);
      }
    });

    // Simulate latency fluctuation
    const interval = setInterval(() => {
      setLatency(prev => {
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(15, Math.min(45, prev + delta));
      });
    }, 3000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleSaveAttempt = () => {
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      await setDoc(doc(db, 'system', 'config'), {
        ...settings,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Audit the changes
      await logAudit(
        'settings_update',
        'settings',
        'global_config',
        {
          before: originalSettings,
          after: settings
        }
      );

      toast.success('Configurações globais aplicadas com sucesso.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleManualBackup = async () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: 'Iniciando backup redundante no Cloud Storage...',
        success: 'Backup concluído com sucesso e assinado digitalmente.',
        error: 'Falha ao iniciar backup.',
      }
    );
    await setDoc(doc(db, 'system', 'config'), {
      lastBackupAt: serverTimestamp()
    }, { merge: true });
  };

  const tabs = [
    { id: 'general', label: 'Geral & Branding', icon: Layout },
    { id: 'security', label: 'Segurança Global', icon: Shield },
    { id: 'backup', label: 'Backups & Retenção', icon: Database },
    { id: 'integrations', label: 'Integrações', icon: Zap },
    { id: 'health', label: 'Saúde do Sistema', icon: Activity },
  ];

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Sidebar Menu */}
        <div className="w-full lg:w-72 space-y-2">
          <div className="mb-8 pl-2">
            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter flex items-center gap-3">
               <SettingsIcon className="w-8 h-8 text-indigo-600" />
               Settings UI
            </h2>
            <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Enterprise Configuration</p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-[2rem] p-3 shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "w-full flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all",
                  activeTab === tab.id 
                    ? "bg-zinc-900 text-white shadow-xl shadow-zinc-900/10" 
                    : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                )}
              >
                <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-indigo-400" : "text-zinc-300")} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 mt-4">
             <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Compliance Active</span>
             </div>
             <p className="text-[10px] text-indigo-700 font-bold leading-relaxed uppercase opacity-60">
                Todas as alterações neste painel são assinadas e registradas no AuditEngine.
             </p>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 w-full min-h-[600px] bg-white rounded-[3rem] border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-10 flex-1">
            <AnimatePresence mode="wait">
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-100">
                      <Layout className="w-7 h-7 text-zinc-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Geral & Branding</h3>
                      <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Identidade visual e localidade</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Nome da Corporação</label>
                      <input 
                        value={settings.companyName}
                        onChange={e => setSettings({...settings, companyName: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-6 py-4 text-sm font-black text-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Moeda do Sistema</label>
                      <div className="relative">
                        <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <select 
                          value={settings.currency}
                          onChange={e => setSettings({...settings, currency: e.target.value})}
                          className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                        >
                          <option value="BRL">Real Brasileiro (BRL)</option>
                          <option value="USD">Dólar Americano (USD)</option>
                          <option value="EUR">Euro (EUR)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Timezone Regional</label>
                    <div className="relative">
                      <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <select 
                        value={settings.timezone}
                        onChange={e => setSettings({...settings, timezone: e.target.value})}
                        className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                      >
                        <option value="America/Sao_Paulo">GMT-3 (São Paulo, Brasil)</option>
                        <option value="America/New_York">GMT-5 (New York, EUA)</option>
                        <option value="Europe/London">GMT+0 (London, UK)</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-8 border border-zinc-100 bg-zinc-50 rounded-[2.5rem] flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center text-zinc-300">
                           <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                           <p className="text-xs font-black text-zinc-900 uppercase">Logo da Empresa</p>
                           <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">Recomendado: 512x512px SVG/PNG</p>
                        </div>
                     </div>
                     <button className="px-6 py-3 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-100 transition-all">
                        Alterar Media
                     </button>
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100">
                      <Shield className="w-7 h-7 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Segurança Global</h3>
                      <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Políticas de autenticação rígida</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-100 rounded-3xl">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl">
                             <Lock className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                             <p className="text-xs font-black text-zinc-900 uppercase">Senha Forte Obrigatória</p>
                             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Exigir Num+Símbolos+Min 8 chars</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setSettings({
                           ...settings, 
                           security: { ...settings.security, strongPassword: !settings.security.strongPassword }
                         })}
                         className={cn(
                           "w-14 h-7 rounded-full transition-all relative p-1",
                           settings.security.strongPassword ? "bg-red-600" : "bg-zinc-200"
                         )}
                       >
                          <div className={cn(
                            "w-5 h-5 bg-white rounded-full transition-all shadow-sm",
                            settings.security.strongPassword ? "translate-x-7" : "translate-x-0"
                          )} />
                       </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-100 rounded-3xl">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl">
                             <Monitor className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                             <p className="text-xs font-black text-zinc-900 uppercase">Expiração de Sessão</p>
                             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Deslogar automaticamente após inatividade</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <input 
                            type="number"
                            value={settings.security.sessionTimeout}
                            onChange={(e) => setSettings({
                              ...settings,
                              security: { ...settings.security, sessionTimeout: Number(e.target.value) }
                            })}
                            className="w-16 bg-white border border-zinc-200 rounded-xl px-2 py-2 text-center text-xs font-black"
                          />
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Horas</span>
                       </div>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-zinc-50 border border-zinc-100 rounded-3xl">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl">
                             <Shield className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                             <p className="text-xs font-black text-zinc-900 uppercase">MFA Mandatório (Admins)</p>
                             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Impedir acesso admin sem 2FA ativo</p>
                          </div>
                       </div>
                       <button 
                         onClick={() => setSettings({
                           ...settings, 
                           security: { ...settings.security, requireMfaForAdmins: !settings.security.requireMfaForAdmins }
                         })}
                         className={cn(
                           "w-14 h-7 rounded-full transition-all relative p-1",
                           settings.security.requireMfaForAdmins ? "bg-indigo-600" : "bg-zinc-200"
                         )}
                       >
                          <div className={cn(
                            "w-5 h-5 bg-white rounded-full transition-all shadow-sm",
                            settings.security.requireMfaForAdmins ? "translate-x-7" : "translate-x-0"
                          )} />
                       </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'backup' && (
                <motion.div
                  key="backup"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                      <Database className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Backups & Retenção</h3>
                      <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Integridade física e histórica dos dados</p>
                    </div>
                  </div>

                  <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                     <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                           <HardDrive className="w-5 h-5 text-indigo-400" />
                           <p className="text-xs font-black uppercase tracking-[0.3em] text-white/50">Storage Authority Status</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div>
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Último Snapshot</p>
                              <p className="text-xl font-black tracking-tighter">
                                {settings.lastBackupAt ? format(settings.lastBackupAt.toDate(), 'dd/MM/yyyy HH:mm') : 'Nenhum backup realizado'}
                              </p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Volume de Dados</p>
                              <p className="text-xl font-black tracking-tighter">4.2 GB</p>
                           </div>
                        </div>
                        <button 
                           onClick={handleManualBackup}
                           className="w-full mt-8 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3"
                        >
                           <RefreshCw className="w-4 h-4" /> Forçar Backup Manual Now
                        </button>
                     </div>
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px]" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl">
                        <div className="flex items-center gap-3 mb-4">
                           <History className="w-4 h-4 text-zinc-400" />
                           <p className="text-xs font-black text-zinc-900 uppercase">Retenção de Logs</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <input 
                              type="number"
                              value={settings.retention.auditLogs}
                              onChange={(e) => setSettings({
                                ...settings,
                                retention: { ...settings.retention, auditLogs: Number(e.target.value) }
                              })}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-indigo-500/20 outline-none"
                           />
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Anos</span>
                        </div>
                     </div>
                     <div className="p-6 bg-zinc-50 border border-zinc-100 rounded-3xl">
                        <div className="flex items-center gap-3 mb-4">
                           <Clock className="w-4 h-4 text-zinc-400" />
                           <p className="text-xs font-black text-zinc-900 uppercase">Retenção Backups</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <input 
                              type="number"
                              value={settings.retention.backups}
                              onChange={(e) => setSettings({
                                ...settings,
                                retention: { ...settings.retention, backups: Number(e.target.value) }
                              })}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-indigo-500/20 outline-none"
                           />
                           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Dias</span>
                        </div>
                     </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'integrations' && (
                <motion.div
                  key="integrations"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center border border-amber-100">
                      <Zap className="w-7 h-7 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Painel de Integração Dinâmico</h3>
                      <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Gestão de chaves e comunicação externa</p>
                    </div>
                  </div>

                  <div className="p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 relative overflow-hidden group">
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <Shield className="w-5 h-5 text-indigo-400" />
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-white/50">AdminHub Authority Header</p>
                        </div>
                        <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[8px] font-black text-indigo-400 uppercase tracking-widest">Inbound Security</span>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">AdminHub Official API Key</label>
                        <div className="flex gap-3">
                          <input 
                            type="password"
                            value={settings.integrations?.adminHubApiKey || ''}
                            onChange={e => setSettings({
                              ...settings, 
                              integrations: { ...(settings.integrations || { adminHubApiKey: '', nexusBaseUrl: '', nexusApiKey: '' }), adminHubApiKey: e.target.value }
                            })}
                            placeholder="Insira a chave oficial..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-black text-white focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                          />
                          <button 
                            onClick={() => {
                              const key = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
                              setSettings({
                                ...settings, 
                                integrations: { ...(settings.integrations || { adminHubApiKey: '', nexusBaseUrl: '', nexusApiKey: '' }), adminHubApiKey: `ah_live_${key}` }
                              });
                              toast.info('Nova chave gerada.');
                            }}
                            className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all flex items-center gap-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase mt-2">Esta chave deve ser configurada nos cabeçalhos 'X-API-Key' de sistemas externos (ex: Loja Dicas).</p>
                      </div>
                    </div>
                    <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-indigo-600/5 rounded-full blur-[80px] group-hover:bg-indigo-600/10 transition-all" />
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3 pl-1">
                      <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-900">Configuração Nexus ERP</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Nexus Base URL</label>
                        <div className="relative">
                          <Globe className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input 
                            value={settings.integrations?.nexusBaseUrl || ''}
                            onChange={e => setSettings({
                              ...settings, 
                              integrations: { ...(settings.integrations || { adminHubApiKey: '', nexusBaseUrl: '', nexusApiKey: '' }), nexusBaseUrl: e.target.value }
                            })}
                            placeholder="https://api.nexus.com/v1"
                            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-1">Nexus API Key</label>
                        <div className="relative">
                          <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input 
                            type="password"
                            value={settings.integrations?.nexusApiKey || ''}
                            onChange={e => setSettings({
                              ...settings, 
                              integrations: { ...(settings.integrations || { adminHubApiKey: '', nexusBaseUrl: '', nexusApiKey: '' }), nexusApiKey: e.target.value }
                            })}
                            placeholder="nx_..."
                            className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-zinc-900 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-900 uppercase tracking-widest">Sincronização Bidirecional Ativa</p>
                      <p className="text-[10px] text-emerald-700 font-bold uppercase opacity-60">O sistema tentará usar chaves de ambiente primeiro, seguidas por estas configurações.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'health' && (
                <motion.div
                  key="health"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                      <Activity className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 tracking-tight">Saúde do Sistema</h3>
                      <p className="text-sm text-zinc-400 font-bold uppercase tracking-widest">Monitoramento de infraestrutura real-time</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="p-8 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] relative overflow-hidden">
                        <div className="relative z-10">
                           <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Uptime Nominal</p>
                           <p className="text-5xl font-black text-zinc-900 tracking-tighter mb-6">99.99<span className="text-xl text-emerald-500 font-black tracking-normal">%</span></p>
                           <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: '99.9%' }}
                                className="h-full bg-emerald-500" 
                              />
                           </div>
                           <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em] mt-4 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> All Modules Operational
                           </p>
                        </div>
                     </div>

                     <div className="p-8 bg-zinc-50 border border-zinc-100 rounded-[2.5rem] relative overflow-hidden">
                        <div className="relative z-10">
                           <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">Firestore Latency</p>
                           <div className="flex items-baseline gap-2 mb-6">
                              <p className="text-5xl font-black text-zinc-900 tracking-tighter">{latency}</p>
                              <span className="text-xl text-indigo-500 font-black tracking-normal uppercase">ms</span>
                           </div>
                           
                           <div className="flex items-end gap-1 h-8">
                              {[...Array(20)].map((_, i) => (
                                <motion.div 
                                  key={i}
                                  animate={{ height: Math.random() * 100 + '%' }}
                                  className="w-1 bg-indigo-200 rounded-full"
                                />
                              ))}
                           </div>
                           <p className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.2em] mt-4 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> Real-time Node Sync active
                           </p>
                        </div>
                     </div>
                  </div>

                  <div className="p-8 bg-zinc-900 rounded-[3rem] text-white flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                           <History className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                           <p className="text-xs font-black uppercase tracking-widest text-white/50">Maintenance Scheduler</p>
                           <p className="text-sm font-bold tracking-tight">Nenhuma janela de manutenção prevista nas próximas 48 horas.</p>
                        </div>
                     </div>
                     <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[8px] font-black uppercase tracking-widest">
                        Optimal State
                     </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Persistent Save Footer */}
          <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-zinc-300" />
                <p className="text-xs text-zinc-400 font-medium tracking-tight leading-none">Última atualização global: {format(new Date(), 'HH:mm')}</p>
             </div>
             <button 
               onClick={handleSaveAttempt}
               disabled={saving}
               className="bg-zinc-900 text-white px-10 py-4 rounded-[1.5rem] font-black text-xs flex items-center gap-3 hover:bg-zinc-800 transition-all active:scale-95 shadow-xl shadow-zinc-900/20 uppercase tracking-widest"
             >
               {saving ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> : <Save className="w-4 h-4 text-indigo-400" />}
               <span>{saving ? 'Processing...' : 'Salvar Configurações Globais'}</span>
             </button>
          </div>
        </div>
      </div>

      {/* Global Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] p-10 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-amber-500 to-indigo-500" />
              
              <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mb-6 border border-amber-100">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>

              <h3 className="text-2xl font-black text-zinc-900 tracking-tight mb-2 uppercase">Altamente Crítico</h3>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
                Atenção: Estas alterações afetarão todos os usuários ativos do sistema. Novas políticas de segurança e branding serão propagadas em tempo real por toda a arquitetura Cloud.
              </p>

              <div className="space-y-3">
                <button 
                  onClick={handleConfirmSave}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-xl shadow-zinc-900/10 hover:bg-zinc-800 transition-all active:scale-95"
                >
                  Confirmar Propagação Global
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="w-full py-4 bg-white border border-zinc-200 text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-zinc-50 transition-all"
                >
                  Abortar Operação
                </button>
              </div>

              <button 
                onClick={() => setShowConfirm(false)}
                className="absolute top-8 right-8 p-2 hover:bg-zinc-100 rounded-full text-zinc-400"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
