import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Task } from '@/src/types';
import { CheckSquare, Calendar, Flag, User, Clock, Filter, ListFilter, Plus, MoreVertical } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function TasksModule() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(docs.length > 0 ? docs : [
        { title: 'Revisar Folha de Pagamento', description: 'Conferir horas extras do setor de T.I.', priority: 'high', assignedTo: 'Ana Silva', status: 'todo', createdAt: new Date() },
        { title: 'Reposição de Periféricos', description: 'Comprar 15 teclados mecânicos para novos hires.', priority: 'medium', assignedTo: 'Admin', status: 'in_progress', createdAt: new Date() },
        { title: 'Apresentação Trimestral', description: 'Preparar slides para diretoria.', priority: 'critical', assignedTo: 'Admin', status: 'completed', createdAt: new Date() },
      ]);
    });
    return () => unsubscribe();
  }, []);

  const columns = [
    { id: 'todo', label: 'A Fazer', color: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
    { id: 'in_progress', label: 'Em Andamento', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { id: 'completed', label: 'Concluído', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  ];

  const priorityColor = (p: string) => {
    switch(p) {
      case 'critical': return 'text-red-600 bg-red-100 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium': return 'text-blue-600 bg-blue-100 border-blue-200';
      default: return 'text-zinc-500 bg-zinc-100 border-zinc-200';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Fluxo de Trabalho</h2>
          <p className="text-zinc-500">Coordene as ações de todos os setores em um só lugar.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex -space-x-2 mr-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-8 h-8 rounded-full bg-zinc-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-zinc-500">
                U{i}
              </div>
            ))}
            <div className="w-8 h-8 rounded-full bg-zinc-900 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">
              +12
            </div>
          </div>
          <button className="bg-zinc-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-zinc-800 transition-all flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Adicionar Tarefa</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-6 py-2 border-b border-zinc-200 text-sm font-bold text-zinc-400 overflow-x-auto whitespace-nowrap">
        <button className="text-zinc-900 border-b-2 border-zinc-900 pb-2 px-1 transition-all">Todas as Tarefas</button>
        <button className="hover:text-zinc-600 border-b-2 border-transparent pb-2 px-1 transition-all">RH</button>
        <button className="hover:text-zinc-600 border-b-2 border-transparent pb-2 px-1 transition-all">Financeiro</button>
        <button className="hover:text-zinc-600 border-b-2 border-transparent pb-2 px-1 transition-all">Importantes</button>
        <div className="flex-1"></div>
        <div className="flex items-center space-x-4 pb-2">
           <Filter className="w-4 h-4 cursor-pointer hover:text-zinc-900" />
           <ListFilter className="w-4 h-4 cursor-pointer hover:text-zinc-900" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-[600px]">
        {columns.map(col => (
          <div key={col.id} className="flex flex-col bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200/50 p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center space-x-2">
                <span className={cn("inline-block w-2.5 h-2.5 rounded-full", col.id === 'todo' ? "bg-zinc-300" : col.id === 'in_progress' ? "bg-blue-500" : "bg-emerald-500")}></span>
                <span className="text-sm font-black text-zinc-900 uppercase tracking-widest">{col.label}</span>
                <span className="text-[10px] font-bold bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded-md ml-1">
                  {tasks.filter(t => t.status === col.id).length}
                </span>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 custom-scrollbar">
              {tasks.filter(t => t.status === col.id).map((task, idx) => (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  key={task.id || task.title}
                  className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-grab active:cursor-grabbing group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md border", priorityColor(task.priority))}>
                      {task.priority}
                    </span>
                    <button className="text-zinc-300 hover:text-zinc-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{task.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                  
                  <div className="mt-4 pt-3 border-t border-zinc-50 flex items-center justify-between">
                    <div className="flex items-center text-[10px] font-bold text-zinc-400">
                      <User className="w-3 h-3 mr-1" />
                      {task.assignedTo}
                    </div>
                    <div className="flex items-center text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md">
                      <Clock className="w-3 h-3 mr-1" />
                      4d
                    </div>
                  </div>
                </motion.div>
              ))}
              
              <button className="w-full py-2 flex items-center justify-center space-x-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border-2 border-dashed border-zinc-200 hover:border-blue-200 transition-all text-xs font-bold mt-2">
                <Plus className="w-4 h-4" />
                <span>Nova Tarefa</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
