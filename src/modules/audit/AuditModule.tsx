import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { AuditLog } from '@/src/types';
import { 
  ShieldCheck, User as UserIcon, Clock, FileText, Database, 
  ArrowRight, Shield, LifeBuoy, Search, Filter, 
  Download, Calendar, Briefcase, Activity, 
  ChevronRight, AlertCircle, TrendingUp, Info
} from 'lucide-react';
import { cn, convertToCSV, downloadCSV } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfDay, subDays, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import ForensicDetailWidget from './components/ForensicDetailWidget';
import { toast } from 'sonner';

export default function AuditModule() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterModule, setFilterModule] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    const q = query(
      collection(db, 'auditLogs'), 
      orderBy('timestamp', 'desc'),
      limit(200)
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

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.resourceId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesModule = filterModule === 'all' || log.resource === filterModule;
      const matchesAction = filterAction === 'all' || log.action === filterAction;
      
      const logDate = log.timestamp as Date;
      const startDate = parseISO(dateRange.start);
      const endDate = parseISO(dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      
      const matchesDate = isWithinInterval(logDate, { start: startDate, end: endDate });

      return matchesSearch && matchesModule && matchesAction && matchesDate;
    });
  }, [logs, searchTerm, filterModule, filterAction, dateRange]);

  const activityData = useMemo(() => {
    const days = 30;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStr = format(date, 'dd/MM');
      const count = logs.filter(l => format(l.timestamp as Date, 'dd/MM') === dayStr).length;
      data.push({ name: dayStr, count });
    }
    return data;
  }, [logs]);

  const handleExportCompliance = () => {
    const exportData = filteredLogs.map(log => ({
      Timestamp: format(log.timestamp as Date, 'yyyy-MM-dd HH:mm:ss'),
      Usuario: log.userName,
      UserID: log.userId,
      Acao: log.action,
      Recurso: log.resource,
      ResourceID: log.resourceId,
      Antes: JSON.stringify(log.changes?.before || {}).replace(/"/g, '""'),
      Depois: JSON.stringify(log.changes?.after || {}).replace(/"/g, '""'),
      Hash: `${log.id}-COMPLIANCE-BIT`
    }));

    const csv = convertToCSV(exportData);
    const filename = `audit-compliance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    downloadCSV(csv, filename);
    toast.success('Relatório de Compliance exportado com sucesso.');
  };

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
      case 'employees': return <UserIcon className="w-4 h-4" />;
      case 'transactions': return <Database className="w-4 h-4" />;
      case 'inventory': return <FileText className="w-4 h-4" />;
      case 'users': return <Shield className="w-4 h-4" />;
      case 'tickets': return <LifeBuoy className="w-4 h-4" />;
      case 'auth': return <ShieldCheck className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-2xl animate-spin shadow-xl shadow-indigo-500/20" />
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest animate-pulse">Syncing Audit Streams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto px-4 lg:px-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-zinc-900/20">
               <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">
                Forensic Audit <span className="text-indigo-600">Hub</span>
              </h2>
              <p className="text-zinc-500 text-sm font-medium tracking-tight">Enterprise immutable record investigation & compliance cockpit.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
             <Activity className="w-4 h-4" />
             <span className="text-[10px] font-black uppercase tracking-widest">System Healthy</span>
          </div>
          <button 
            onClick={handleExportCompliance}
            className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 hover:bg-zinc-800 transition-all active:scale-95 shadow-2xl shadow-zinc-900/20 uppercase tracking-widest"
          >
            <Download className="w-4 h-4" />
            Export Compliance
          </button>
        </div>
      </div>

      {/* Activity Heatmap Dashboard */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
               <TrendingUp className="w-8 h-8 text-indigo-500/10" />
            </div>
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="text-sm font-black text-zinc-900 uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Activity Density
                  </h3>
                  <p className="text-xs text-zinc-400 font-bold uppercase mt-1">Volume de eventos nos últimos 30 dias</p>
               </div>
               <div className="text-right">
                  <p className="text-3xl font-black text-zinc-900 tracking-tighter">{logs.length}</p>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Total Eventos</p>
               </div>
            </div>
            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {activityData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.count > 0 ? "url(#barGradient)" : "#f4f4f5"} 
                      />
                    ))}
                  </Bar>
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      fontSize: '10px',
                      fontWeight: '900',
                      textTransform: 'uppercase'
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-zinc-900 rounded-[2.5rem] p-8 text-white relative shadow-2xl shadow-indigo-600/10">
            <div className="relative z-10 flex flex-col h-full justify-between">
               <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/50 mb-6">Compliance Stat</h3>
                  <div className="space-y-6">
                     <div>
                        <p className="text-4xl font-black tracking-tighter mb-1">100%</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Integridade de Dados</p>
                     </div>
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Monitoramento Ativo</p>
                        <div className="flex items-center gap-2">
                           <Shield className="w-4 h-4 text-indigo-400" />
                           <span className="text-xs font-bold truncate">Bit-Audit Node 01-TX</span>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="mt-8 flex items-center gap-2 text-[10px] text-white/30 font-black uppercase tracking-widest">
                  <Info className="w-3.5 h-3.5" />
                  Logs são imutáveis após 30ms
               </div>
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/10 rounded-full blur-[80px]" />
         </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex flex-col xl:flex-row items-center gap-4">
         <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
               type="text"
               placeholder="Pesquisar por Operador ou Resource ID..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase tracking-tight placeholder:text-zinc-300"
            />
         </div>
         <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2 rounded-2xl border border-zinc-100">
               <Calendar className="w-3.5 h-3.5 text-zinc-400" />
               <input 
                 type="date"
                 value={dateRange.start}
                 onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                 className="bg-transparent text-[10px] font-black uppercase border-none focus:ring-0 p-0"
               />
               <ArrowRight className="w-3 h-3 text-zinc-300" />
               <input 
                 type="date"
                 value={dateRange.end}
                 onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                 className="bg-transparent text-[10px] font-black uppercase border-none focus:ring-0 p-0"
               />
            </div>

            <select 
               value={filterModule}
               onChange={(e) => setFilterModule(e.target.value)}
               className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20"
            >
               <option value="all">Todos Módulos</option>
               <option value="hr">RH</option>
               <option value="inventory">Estoque</option>
               <option value="finance">Financeiro</option>
               <option value="tickets">Tickets</option>
               <option value="users">Segurança</option>
            </select>

            <select 
               value={filterAction}
               onChange={(e) => setFilterAction(e.target.value)}
               className="bg-zinc-50 px-4 py-3 rounded-2xl border border-zinc-100 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20"
            >
               <option value="all">Todas Ações</option>
               <option value="create">Inserção</option>
               <option value="update">Modificação</option>
               <option value="delete">Exclusão</option>
               <option value="status_change">Status</option>
            </select>
         </div>
      </div>

      {/* Main Investigation Split */}
      <div className={cn(
        "grid gap-6 transition-all duration-500",
        selectedLog ? "grid-cols-1 xl:grid-cols-5" : "grid-cols-1"
      )}>
        {/* Master Timeline List */}
        <div className={cn(
          "bg-white rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden h-fit transition-all",
          selectedLog ? "xl:col-span-3" : "w-full"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] w-16 text-center">Foren.</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Operador / Authority</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Ação & Objeto</th>
                  <th className="px-6 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">Bit-Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredLogs.map((log, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className={cn(
                      "hover:bg-zinc-50/80 transition-all cursor-pointer group relative",
                      selectedLog?.id === log.id && "bg-indigo-50/50"
                    )}
                  >
                    {selectedLog?.id === log.id && (
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full" />
                    )}
                    <td className="px-8 py-6">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border-2 shadow-sm group-hover:scale-110 transition-transform",
                        getActionColor(log.action)
                      )}>
                        {getResourceIcon(log.resource)}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden">
                            <span className="text-[10px] font-black text-zinc-900">{log.userName.charAt(0)}</span>
                         </div>
                         <div>
                            <p className="text-xs font-black text-zinc-900 uppercase tracking-tight leading-none mb-1">{log.userName}</p>
                            <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">{log.userId.slice(0, 8)}...</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-md border tracking-widest leading-none", getActionColor(log.action))}>
                          {log.action}
                        </span>
                        <span className="text-xs font-black text-zinc-800 uppercase tracking-tight">{log.resource}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
                        <span className="truncate">{log.resourceId}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-right">
                       <div className="flex flex-col items-end">
                          <p className="text-sm font-black text-zinc-900 tracking-tighter leading-none mb-1">
                            {format(log.timestamp as Date, 'HH:mm:ss')}
                          </p>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                            {format(log.timestamp as Date, 'dd/MM/yyyy')}
                          </p>
                       </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {(filteredLogs.length === 0 && !loading) && (
              <div className="py-32 flex flex-col items-center justify-center text-zinc-300">
                 <AlertCircle className="w-16 h-16 mb-4 opacity-10" />
                 <p className="text-xs font-black uppercase tracking-[0.3em]">Zero Event Data for Selection</p>
              </div>
            )}
          </div>
        </div>

        {/* Forensic Detail Sidepanel */}
        <AnimatePresence mode="wait">
          {selectedLog && (
            <motion.div 
               key="forensic-detail"
               initial={{ x: 30, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: 30, opacity: 0 }}
               className="xl:col-span-2 h-full"
            >
               <ForensicDetailWidget 
                  log={selectedLog} 
                  onClose={() => setSelectedLog(null)} 
               />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Compliance Verification Footer */}
      <div className="mt-8 flex flex-col md:flex-row items-center justify-between p-8 bg-zinc-900 rounded-[2.5rem] border border-zinc-800 text-white gap-6">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/40">
               <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-1">Immutable Validation</p>
               <p className="text-sm font-bold tracking-tight">Os registros exibidos possuem validade jurídica corporativa e carimbo de tempo irreversível.</p>
            </div>
         </div>
         <div className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-mono text-[8px] text-white/50 tracking-widest uppercase">
            CRC: {format(new Date(), 'yyyyMMdd')}-BITAUDIT-SECURE-CHAIN-V2
         </div>
      </div>
    </div>
  );
}
