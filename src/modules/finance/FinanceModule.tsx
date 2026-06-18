import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Transaction } from '@/src/types';
import { DollarSign, ArrowUpRight, ArrowDownLeft, Filter, Plus, Calendar, Tag } from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function FinanceModule() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      } as Transaction));
      
      setTransactions(docs.length > 0 ? docs : [
        { title: 'Venda de Software Enterprise', amount: 12500, type: 'income', category: 'Serviços', date: new Date(), status: 'completed' },
        { title: 'Aluguel Escritório', amount: 4200, type: 'expense', category: 'Infra', date: new Date(), status: 'completed' },
        { title: 'Serviços AWS', amount: 890, type: 'expense', category: 'Tecnologia', date: new Date(), status: 'pending' },
      ]);
    });
    return () => unsubscribe();
  }, []);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestão Financeira</h2>
          <p className="text-zinc-500">Controle total de fluxo de caixa e saúda financeira.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Nova Transação</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Saldo Atual</p>
          <p className="text-3xl font-bold text-zinc-900">{formatCurrency(totalIncome - totalExpense)}</p>
          <div className="mt-4 flex items-center text-xs text-zinc-400">
            <Calendar className="w-3 h-3 mr-1" /> Atualizado há 5 minutos
          </div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-sm font-medium text-emerald-600 mb-1">Receitas Totais</p>
          <p className="text-3xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
          <div className="mt-4 flex items-center text-xs text-emerald-500 font-bold">
            <ArrowUpRight className="w-4 h-4 mr-1" /> +8.2% vs mês anterior
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm">
          <p className="text-sm font-medium text-red-600 mb-1">Despesas Totais</p>
          <p className="text-3xl font-bold text-red-700">{formatCurrency(totalExpense)}</p>
          <div className="mt-4 flex items-center text-xs text-red-500 font-bold">
            <ArrowDownLeft className="w-4 h-4 mr-1" /> -2.4% vs mês anterior
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 text-lg">Últimas Transações</h3>
          <button className="flex items-center space-x-2 text-zinc-500 hover:text-zinc-700 text-sm font-bold bg-zinc-50 px-3 py-2 rounded-lg border border-zinc-200">
            <Filter className="w-4 h-4" />
            <span>Filtrar</span>
          </button>
        </div>
        
        <div className="p-2 overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2 px-4 shadow-inner">
            <thead>
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Transação</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Categoria</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase">Data</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase text-right">Valor</th>
                <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={t.id || t.title} 
                  className="bg-zinc-50/50 hover:bg-white transition-all group rounded-xl"
                >
                  <td className="px-4 py-4 rounded-l-xl">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border",
                        t.type === 'income' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                      )}>
                        {t.type === 'income' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                      </div>
                      <span className="text-sm font-bold text-zinc-800">{t.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-zinc-500">
                    <div className="flex items-center space-x-1">
                      <Tag className="w-3 h-3" />
                      <span>{t.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-500">
                    {t.date.toLocaleDateString('pt-BR')}
                  </td>
                  <td className={cn(
                    "px-4 py-4 text-sm font-bold text-right",
                    t.type === 'income' ? "text-emerald-600" : "text-red-500"
                  )}>
                    {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                  <td className="px-4 py-4 rounded-r-xl text-center">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                      t.status === 'completed' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      {t.status === 'completed' ? 'Efetivado' : 'Pendente'}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
