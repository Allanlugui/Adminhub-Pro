import { useState, useEffect } from 'react';
import { db } from '@/src/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { Employee } from '@/src/types';
import { Users, UserPlus, Search, MoreHorizontal, Mail, Briefcase, BadgeCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';

export default function HRModule() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Mock initial data if empty (simplified for implementation)
  useEffect(() => {
    const q = query(collection(db, 'employees'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(docs.length > 0 ? docs : [
        { name: 'Ana Silva', role: 'Gerente de RH', department: 'Administrativo', email: 'ana@empresa.com', salary: 8500, status: 'active', hiredAt: new Date() },
        { name: 'Carlos Santos', role: 'Desenvolvedor Senior', department: 'TI', email: 'carlos@empresa.com', salary: 12000, status: 'active', hiredAt: new Date() },
        { name: 'Juliana Lima', role: 'Analista Financeiro', department: 'Financeiro', email: 'juliana@empresa.com', salary: 6500, status: 'active', hiredAt: new Date() },
      ]);
    });
    return () => unsubscribe();
  }, []);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Recursos Humanos</h2>
          <p className="text-zinc-500">Gestão de talentos e estrutura organizacional.</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200">
          <UserPlus className="w-5 h-5" />
          <span className="font-semibold">Novo Colaborador</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou setor..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-zinc-500">Filtrar por Status:</span>
            <select className="bg-white border border-zinc-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all">
              <option>Todos</option>
              <option>Ativos</option>
              <option>Férias</option>
              <option>Desligados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50/50">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Colaborador</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cargo & Setor</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredEmployees.map((employee, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={employee.id || employee.name} 
                  className="hover:bg-zinc-50/80 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-900 leading-none">{employee.name}</p>
                        <div className="flex items-center space-x-1 mt-1">
                          <Mail className="w-3 h-3 text-zinc-400" />
                          <span className="text-xs text-zinc-500">{employee.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-3 h-3 text-zinc-400" />
                        <span className="text-sm font-semibold text-zinc-700">{employee.role}</span>
                      </div>
                      <span className="text-xs text-zinc-500 ml-4">{employee.department}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                      employee.status === 'active' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                    )}>
                      {employee.status === 'active' ? 'Ativo' : 'Afastado'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
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
