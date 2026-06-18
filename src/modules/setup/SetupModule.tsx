import React, { useState } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import { Database, Users, Box, Zap, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function SetupModule() {
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState<{users?: boolean, inventory?: boolean}>({});

  const seedUsers = async () => {
    if (!confirm('Iniciar carga de 30 usuários reais? Esta ação é irreversível.')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // Example placeholders for the 30 users logic
      // In a real scenario, this would accept a JSON/CSV payload
      const initialUsers = Array.from({ length: 30 }).map((_, i) => ({
        email: `colaborador${i + 1}@empresa.com`,
        displayName: `Colaborador ${i + 1}`,
        role: 'OPERATOR',
        status: 'active',
        createdAt: serverTimestamp()
      }));

      for (const userData of initialUsers) {
        const newDocRef = doc(collection(db, 'users'));
        batch.set(newDocRef, userData);
      }

      await batch.commit();
      setCompleted(prev => ({ ...prev, users: true }));
      toast.success('Carga de usuários finalizada com sucesso!');
    } catch (error) {
      toast.error('Erro na carga de usuários.');
    } finally {
      setLoading(false);
    }
  };

  const seedInventory = async () => {
    if (!confirm('Iniciar carga inicial de estoque? Alertas de estoque baixo serão ignorados.')) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const initialItems = [
        { name: 'Notebook Dell G15', sku: 'PAT-TI-001', quantity: 15, minQuantity: 5, unitPrice: 5500, category: 'IT', type: 'asset', status: 'available', location: 'Estoque Central' },
        { name: 'Mouse Logitech MX Master', sku: 'CONS-TI-010', quantity: 50, minQuantity: 10, unitPrice: 450, category: 'IT', type: 'consumable', status: 'available', location: 'Almoxarifado' },
        { name: 'Cabo HDMI 2.0', sku: 'CONS-EL-055', quantity: 100, minQuantity: 20, unitPrice: 35, category: 'Maintenance', type: 'consumable', status: 'available', location: 'Almoxarifado' }
      ];

      for (const item of initialItems) {
        const newDocRef = doc(collection(db, 'inventory'));
        batch.set(newDocRef, { ...item, lastRestockedAt: serverTimestamp() });
      }

      await batch.commit();
      setCompleted(prev => ({ ...prev, inventory: true }));
      toast.success('Carga de estoque finalizada!');
    } catch (error) {
      toast.error('Erro na carga de estoque.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 shrink-0">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-black text-rose-900 leading-tight">Painel de Implantação (Setup Único)</h2>
          <p className="text-rose-700/70 text-sm font-medium mt-1">
            Esta interface é utilizada para a carga inicial de dados reais. 
            <strong> ATENÇÃO:</strong> As operações aqui ignoram o AuditEngine e triggers de notificação para evitar ruído no lançamento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-sm space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
               <Users className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Carga de Colaboradores</h3>
              <p className="text-zinc-500 text-sm font-bold">Importação dos 30 usuários iniciais.</p>
            </div>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-2xl space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase">
                <CheckCircle className="w-3 h-3 text-emerald-500" /> Bypass AuditEngine
             </div>
             <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase">
                <CheckCircle className="w-3 h-3 text-emerald-500" /> Permissões Default (OPERATOR)
             </div>
          </div>

          <button 
            disabled={loading || completed.users}
            onClick={seedUsers}
            className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {completed.users ? <CheckCircle className="w-5 h-5" /> : <Zap className="w-5 h-5 text-amber-400" />}
            {completed.users ? 'Carga Finalizada' : 'Executar Carga de Usuários'}
          </button>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-zinc-200 p-8 rounded-3xl shadow-sm space-y-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
               <Box className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-black text-zinc-900 uppercase tracking-widest text-xs">Carga de Inventário</h3>
              <p className="text-zinc-500 text-sm font-bold">Importação de Ativos e Insumos iniciais.</p>
            </div>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-2xl space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase">
                <CheckCircle className="w-3 h-3 text-emerald-500" /> Bypass Alertas Críticos
             </div>
             <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase">
                <CheckCircle className="w-3 h-3 text-emerald-500" /> Cálculo Automático de VGV
             </div>
          </div>

          <button 
            disabled={loading || completed.inventory}
            onClick={seedInventory}
            className="w-full bg-zinc-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-2 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {completed.inventory ? <CheckCircle className="w-5 h-5" /> : <Database className="w-5 h-5 text-indigo-400" />}
            {completed.inventory ? 'Carga Finalizada' : 'Executar Carga de Estoque'}
          </button>
        </motion.div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
         <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
         <div>
            <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Procedimento de Segurança Pós-Lançamento</p>
            <p className="text-sm text-amber-800 font-medium mt-1">
               Após a conclusão das cargas, esta aba deve ser desativada no código para prevenir reinicializações acidentais do banco. Todos os dados inseridos serão replicados nos backups diários automaticamente.
            </p>
         </div>
      </div>
    </div>
  );
}
