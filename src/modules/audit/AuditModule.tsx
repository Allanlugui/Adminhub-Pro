import React, { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { AuditLog } from '@/src/types';
import { ShieldCheck, User, Clock, FileText, Database, ArrowRight, Shield, LifeBuoy } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function AuditModule() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'auditLogs'), 
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      } as AuditLog));
      setLogs(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'update': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'delete': return 'text-red-600 bg-red-50 border-red-100';
      case 'status_change': return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'upload': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      default: return 'text-zinc-500 bg-zinc-50 border-zinc-100';
    }
  };

  const getResourceIcon = (resource: string) => {
    switch (resource) {
      case 'employees': return <User className="w-4 h-4" />;
      case 'transactions': return <Database className="w-4 h-4" />;
      case 'inventory': return <FileText className="w-4 h-4" />;
      case 'users': return <Shield className="w-4 h-4" />;
      case 'tickets': return <LifeBuoy className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            Logs de Auditoria
          </h2>
          <p className="text-zinc-500 mt-1">Immutable records of all critical system modifications for enterprise compliance.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center w-16">Icon</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ação & Recurso</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Alterações (Antes → Depois)</th>
                <th className="px-6 py-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-sm italic">
                    Nenhum log de auditoria registrado no momento.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    key={log.id} 
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center border", getActionColor(log.action))}>
                        {getResourceIcon(log.resource)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-zinc-900 leading-tight">{log.userName}</p>
                      <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{log.userId.slice(0, 8)}...</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-md border", getActionColor(log.action))}>
                          {log.action}
                        </span>
                        <span className="text-sm font-semibold text-zinc-700 capitalize">{log.resource}</span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1 font-mono">ID: {log.resourceId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-[11px]">
                        {log.action === 'create' ? (
                          <div className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                            Novo objeto criado: <span className="font-mono">{JSON.stringify(log.changes?.after).slice(0, 50)}...</span>
                          </div>
                        ) : log.action === 'delete' ? (
                          <div className="text-red-600 bg-red-50 px-2 py-1 rounded">
                            Objeto removido: <span className="font-mono">{JSON.stringify(log.changes?.before).slice(0, 50)}...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 bg-zinc-50 border border-zinc-100 p-1.5 rounded text-zinc-600">
                             <span className="max-w-[150px] truncate">{JSON.stringify(log.changes?.before)}</span>
                             <ArrowRight className="w-3 h-3 text-zinc-400" />
                             <span className="max-w-[150px] truncate text-blue-600 font-bold">{JSON.stringify(log.changes?.after)}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center space-x-1 text-sm font-bold text-zinc-900">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>{log.timestamp.toLocaleTimeString('pt-BR')}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 mt-0.5">{log.timestamp.toLocaleDateString('pt-BR')}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
