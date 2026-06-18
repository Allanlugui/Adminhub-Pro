import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Settings as SettingsIcon, Building, Globe, Zap, Save, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

export default function SettingsModule() {
  const [config, setConfig] = useState({
    companyName: 'Empresa Exemplo Ltda',
    timezone: 'America/Sao_Paulo',
    syncEnabled: true,
    maintenanceMode: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'config'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as any);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'system', 'config'), {
        ...config,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Configurações atualizadas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Ocorreu um erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center space-x-3">
          <SettingsIcon className="w-8 h-8 text-blue-600" />
          <span>Configurações do Sistema</span>
        </h2>
        <p className="text-zinc-500 mt-1">Gerencie as preferências globais e integrações do AdminHub.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="font-bold text-zinc-900 mb-4 flex items-center space-x-2 text-sm">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Status de Sincronização</span>
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">Latência</span>
                <span className="text-[10px] font-bold text-emerald-500">24ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">Uptime</span>
                <span className="text-[10px] font-bold text-emerald-500">99.9%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">Backup</span>
                <span className="text-[10px] font-bold text-blue-500 text-right">Real-time (Firebase)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center space-x-2">
                  <Building className="w-3.5 h-3.5" />
                  <span>Nome da Organização</span>
                </label>
                <input 
                  value={config.companyName}
                  onChange={e => setConfig({...config, companyName: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center space-x-2">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Fuso Horário Padrão</span>
                </label>
                <select 
                  value={config.timezone}
                  onChange={e => setConfig({...config, timezone: e.target.value})}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="America/Sao_Paulo">Brasil (Brasília - GMT-3)</option>
                  <option value="America/New_York">EUA (New York - GMT-5)</option>
                  <option value="Europe/London">London (GMT+0)</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-zinc-900">Sincronização Ativa</p>
                <p className="text-xs text-zinc-500 leading-tight">Permitir que os módulos troquem dados em tempo real.</p>
              </div>
              <div 
                onClick={() => setConfig({...config, syncEnabled: !config.syncEnabled})}
                className={cn(
                  "w-12 h-6 rounded-full transition-all cursor-pointer relative",
                  config.syncEnabled ? "bg-emerald-500" : "bg-zinc-300"
                )}
              >
                <div className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                  config.syncEnabled ? "left-7" : "left-1"
                )} />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-zinc-900 text-white px-8 py-3 rounded-xl font-bold flex items-center space-x-2 hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
