import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Users, Package, AlertCircle, DollarSign } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

const data = [
  { name: 'Jan', receita: 4000, despesa: 2400 },
  { name: 'Fev', receita: 3000, despesa: 1398 },
  { name: 'Mar', receita: 2000, despesa: 9800 },
  { name: 'Abr', receita: 2780, despesa: 3908 },
  { name: 'Mai', receita: 1890, despesa: 4800 },
  { name: 'Jun', receita: 2390, despesa: 3800 },
];

const hrData = [
  { name: 'RH', total: 45 },
  { name: 'Financeiro', total: 12 },
  { name: 'TI', total: 18 },
  { name: 'Logística', total: 34 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Visão Geral do Ecossistema</h2>
        <p className="text-zinc-500">Acompanhe o desempenho de todos os departamentos em tempo real.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Receita Mensal" 
          value={formatCurrency(124500.00)} 
          change="+12.5%" 
          icon={DollarSign} 
          color="blue" 
        />
        <StatCard 
          title="Colaboradores" 
          value="109" 
          change="+3 este mês" 
          icon={Users} 
          color="emerald" 
        />
        <StatCard 
          title="Itens em Estoque" 
          value="1,420" 
          change="8 baixos" 
          icon={Package} 
          color="amber" 
        />
        <StatCard 
          title="Tarefas Pendentes" 
          value="24" 
          change="-4 desde ontem" 
          icon={AlertCircle} 
          color="indigo" 
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
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} tickFormatter={(v) => `R$ ${v/1000}k`} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-100 flex-1">
            <h4 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4">Atividade Entre-Sistemas</h4>
            <div className="space-y-3">
              <ActivityItem 
                type="hr" 
                msg="Novo colaborador Ana Silva contratada via módulo RH." 
                impact="Impacto Financeiro: Salário R$ 8.5k/mês" 
                time="2m atrás" 
              />
              <ActivityItem 
                type="inventory" 
                msg="Estoque de MacBook Pro atingiu nível crítico (4 un)." 
                impact="Ação: Ordem de compra gerada p/ Financeiro" 
                time="15m atrás" 
              />
              <ActivityItem 
                type="finance" 
                msg="Receita de R$ 12.5k processada via transação 88219." 
                impact="Status: Paga e reconciliada" 
                time="1h atrás" 
              />
            </div>
          </div>
        </div>

        {/* HR Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="font-bold text-zinc-900 mb-8">Colaboradores por Setor</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hrData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#71717a'}} width={80} />
                <Tooltip cursor={{fill: 'transparent'}} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                  {hrData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-medium">Headcount Total:</span>
            <span className="font-bold text-zinc-900">109</span>
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
    finance: DollarSign
  };
  const colors: any = {
    hr: "text-blue-500 bg-blue-50 border-blue-100",
    inventory: "text-amber-500 bg-amber-50 border-amber-100",
    finance: "text-emerald-500 bg-emerald-50 border-emerald-100"
  };
  const Icon = icons[type];

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
