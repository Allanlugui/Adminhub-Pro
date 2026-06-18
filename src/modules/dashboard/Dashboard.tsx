import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Users, Package, AlertCircle, DollarSign, LifeBuoy } from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AuditLog } from '@/src/types';
import { ShieldCheck } from 'lucide-react';

export default function Dashboard() {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState({
    revenue: 0,
    employees: 0,
    inventory: 0,
    tasks: 0,
    lowStock: 0,
    pendingApprovals: 0
  });
  const [hrDist, setHrDist] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Activities
    const qAct = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(10));
    const unsubAct = onSnapshot(qAct, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
    });

    // Stats counts
    const unsubEmp = onSnapshot(collection(db, 'employees'), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(s => ({ ...s, employees: snap.size }));
      const distMap: any = {};
      docs.forEach((d: any) => {
        const dept = d.departmentName || d.department || 'Geral';
        distMap[dept] = (distMap[dept] || 0) + 1;
      });
      setHrDist(Object.keys(distMap).map(name => ({ name, total: distMap[name] })));
    });

    const unsubInv = onSnapshot(collection(db, 'inventory'), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(s => ({ 
        ...s, 
        inventory: snap.size,
        lowStock: docs.filter((i: any) => i.status === 'low_stock' || i.status === 'out_of_stock').length
      }));
    });

    const unsubTickets = onSnapshot(collection(db, 'tickets'), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(s => ({ ...s, tasks: docs.filter((t: any) => t.status !== 'closed' && t.status !== 'resolved').length }));
    });

    const unsubTrans = onSnapshot(collection(db, 'transactions'), snap => {
      const docs = snapshotToTransactions(snap);
      
      const total = docs.reduce((acc, data: any) => {
        if (data.status !== 'approved' && data.status !== 'paid') return acc;
        const amount = Number(data.amount) || 0;
        return data.type === 'income' ? acc + amount : acc - amount;
      }, 0);
      const pendingCount = docs.filter((d: any) => d.status === 'pending_approval' || d.status === 'pending').length;
      setStats(s => ({ ...s, revenue: total || 0, pendingApprovals: pendingCount }));

      // Process chart data (last 7 days or similar)
      // For production simplicity, we start with empty or zeros if no data
      setChartData([]);
    });

    return () => { unsubAct(); unsubEmp(); unsubInv(); unsubTickets(); unsubTrans(); };
  }, []);

  const snapshotToTransactions = (snap: any) => {
    return snap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Visão Geral do Ecossistema</h2>
          <p className="text-zinc-500">Acompanhe o desempenho de todos os departamentos em tempo real.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full border border-zinc-200">
           <div className="w-2 h-2 bg-zinc-400 rounded-full"></div>
           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Environment Live</span>
        </div>
      </div>

      {/* Action Center - Active Alerts */}
      {(stats.pendingApprovals > 0 || stats.lowStock > 0 || stats.tasks > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatePresence>
            {stats.pendingApprovals > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 group cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 scale-110">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900 leading-tight">Alçadas Pendentes</h4>
                  <p className="text-xs text-amber-700 mt-0.5">Existem {stats.pendingApprovals} pagamentos aguardando sua revisão.</p>
                </div>
              </motion.div>
            )}
            {stats.tasks > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-4 group cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 scale-110">
                  <LifeBuoy className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-indigo-900 leading-tight">SLA em Alerta</h4>
                  <p className="text-xs text-indigo-700 mt-0.5">Você tem {stats.tasks} chamados críticos na fila do Service Desk.</p>
                </div>
              </motion.div>
            )}
            {stats.lowStock > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-4 group cursor-pointer hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 scale-110">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-900 leading-tight">Estoque Crítico</h4>
                  <p className="text-xs text-rose-700 mt-0.5">{stats.lowStock} itens estão abaixo da margem de segurança.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Saldo em Caixa" 
          value={formatCurrency(stats.revenue)} 
          change={`${stats.revenue >= 0 ? '+' : ''}${((stats.revenue/1000).toFixed(1))}k`} 
          icon={DollarSign} 
          color="blue" 
        />
        <StatCard 
          title="Colaboradores" 
          value={stats.employees} 
          change={`Setores: ${hrDist.length}`} 
          icon={Users} 
          color="emerald" 
        />
        <StatCard 
          title="Itens em Estoque" 
          value={stats.inventory} 
          change={stats.lowStock > 0 ? `${stats.lowStock} alertas` : 'Saudável'} 
          icon={Package} 
          color="amber" 
        />
        <StatCard 
          title="Aprovações Pendentes" 
          value={stats.pendingApprovals} 
          change={stats.pendingApprovals > 0 ? "Ação Requerida" : "Em dia"} 
          icon={ShieldCheck} 
          color="indigo" 
        />
        <StatCard 
          title="Tickets Ativos" 
          value={stats.tasks} 
          change={stats.tasks > 0 ? `${stats.tasks} abertos` : "SLA limpo"} 
          icon={LifeBuoy} 
          color="rose" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Financial Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-zinc-900">Fluxo de Caixa</h3>
            <div className="flex space-x-4 text-xs font-medium">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span> Receita
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-red-400 rounded-full mr-2"></span> Despesa
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
              {chartData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-xs font-black text-zinc-300 uppercase tracking-widest">Aguardando dados transacionais...</p>
                </div>
              )}
            </ResponsiveContainer>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex-1">
            <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Sincronização de Auditoria
            </h4>
            <div className="space-y-3">
              {activities.length > 0 ? activities.map((act) => (
                <ActivityItem 
                  key={act.id}
                  type={
                    act.resource === 'employees' ? 'hr' : 
                    act.resource === 'transactions' ? 'finance' : 
                    act.resource === 'tickets' ? 'tickets' :
                    act.resource === 'inventory' ? 'inventory' : 'audit'
                  } 
                  msg={`${act.action.toUpperCase()}: ${act.resource}`} 
                  impact={`Responsável: ${act.userName}`} 
                  time={act.timestamp?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || 'Agora'} 
                />
              )) : (
                <p className="text-xs text-zinc-400 text-center py-4">Nenhuma atividade de auditoria sincronizada.</p>
              )}
            </div>
          </div>
        </div>

        {/* HR Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
          <h3 className="font-bold text-zinc-900 mb-8">Distribuição de Talentos</h3>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hrDist.length > 0 ? hrDist : [{name: 'Sem Dados', total: 0}]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} width={80} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                  {hrDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-medium">Headcount Ativo:</span>
            <span className="font-bold text-zinc-900">{stats.employees}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ type, msg, impact, time }: any) {
  const icons: any = {
    hr: Users,
    inventory: Package,
    finance: DollarSign,
    tickets: LifeBuoy,
    audit: ShieldCheck
  };
  const colors: any = {
    hr: "text-blue-500 bg-blue-50 border-blue-100",
    inventory: "text-amber-500 bg-amber-50 border-amber-100",
    finance: "text-emerald-500 bg-emerald-50 border-emerald-100",
    tickets: "text-indigo-500 bg-indigo-50 border-indigo-100",
    audit: "text-zinc-500 bg-zinc-50 border-zinc-100"
  };
  const Icon = icons[type] || icons.audit;

  return (
    <div className="flex items-start space-x-3 p-3 rounded-xl hover:bg-zinc-50 transition-colors border border-transparent hover:border-zinc-100">
      <div className={cn("p-2 rounded-lg border", colors[type])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-zinc-900">{msg}</p>
          <span className="text-[10px] font-medium text-zinc-400">{time}</span>
        </div>
        <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">{impact}</p>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 px-3 rounded-xl border flex items-center justify-center", colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          {change}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <p className="text-2xl font-bold text-zinc-900 mt-1">{value}</p>
      </div>
    </motion.div>
  );
}
