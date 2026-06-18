import React from 'react';
import { Employee } from '@/src/types';
import { X, User, Briefcase, CreditCard, Heart, FileText, BarChart3, History, Mail, Phone, MapPin, ShieldCheck, Calendar, ArrowRight, Edit, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EmployeeDetailsProps {
  employee: Employee;
  onClose: () => void;
  variant?: 'modal' | 'widget';
}

export default function EmployeeDetails({ employee, onClose, variant = 'modal' }: EmployeeDetailsProps) {
  const [activeTab, setActiveTab] = React.useState('personal');

  const tabs = [
    { id: 'personal', label: 'Dados Pessoais', icon: User },
    { id: 'contract', label: 'Contrato & Benefícios', icon: Briefcase },
    { id: 'docs', label: 'Anexos', icon: FileText },
  ];

  const chartData = (employee.performanceScore ? [
    { name: 'Jan', score: 0 },
    { name: 'Fev', score: 0 },
    { name: 'Mar', score: 0 },
    { name: 'Abr', score: 0 },
    { name: 'Mai', score: 0 },
    { name: 'Jun', score: employee.performanceScore },
  ] : []);

  const totalVariável = (employee.benefits?.mealVoucher || 0) + (employee.benefits?.transportVoucher ? 250 : 0);

  const formatDate = (date: any) => {
    if (!date) return '---';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return '---';
    }
  };

  const content = (
    <div className={cn(
      "bg-white flex flex-col h-full",
      variant === 'widget' ? "rounded-[2rem] border border-zinc-200 shadow-sm" : "shadow-2xl"
    )}>
      {/* Header */}
      <div className="p-6 border-b border-zinc-100 relative">
        <div className="absolute top-6 right-6">
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Auditável
          </span>
        </div>
        <div className="flex items-center mb-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl mr-4 border-2 border-indigo-200">
             {employee.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-black text-zinc-900 leading-tight">{employee.name}</h2>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-tight">{employee.email}</p>
          </div>
        </div>
        
        <div className="flex space-x-6 border-b border-zinc-100">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "pb-2 text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab.id ? "border-b-2 border-indigo-600 text-indigo-600" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6">
        {activeTab === 'personal' && (
          <>
            {/* Onboarding Flow */}
            <div>
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Fluxo de Onboarding</h3>
              <div className="flex items-center text-[10px] font-black space-x-2">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded border border-emerald-200 uppercase tracking-tighter">Onboarding</span>
                <span className="text-zinc-300">→</span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded border border-emerald-200 uppercase tracking-tighter">Entrevista</span>
                <span className="text-zinc-300">→</span>
                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded border border-indigo-200 uppercase tracking-tighter">Ativo</span>
                <span className="text-zinc-300">→</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-400 rounded border border-zinc-200 uppercase tracking-tighter">Offboarding</span>
              </div>
            </div>

            {/* Performance Chart */}
            <div>
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Indicador de Desempenho</h3>
              <div className="h-32 bg-zinc-50/50 border border-zinc-100 rounded-2xl p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <Bar dataKey="score" radius={[2, 2, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 5 ? '#4f46e5' : '#e2e8f0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Benefits Content (matches mockup screenshot table style) */}
            <div>
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Benefícios Atuais</h3>
              <div className="space-y-2.5">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-zinc-500 uppercase">Provisão Anual Saúde</span>
                  <span className="text-zinc-900">{formatCurrency(employee.salary * 0.12)}</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-zinc-500 uppercase">Auxílio Home Office</span>
                  <span className="text-zinc-900">R$ 250,00</span>
                </div>
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="text-zinc-500 uppercase">Utilização Mensal VR</span>
                  <span className="text-zinc-900">{formatCurrency(employee.benefits?.mealVoucher || 0)}</span>
                </div>
                <div className="border-t border-zinc-100 pt-2.5 mt-2.5 flex justify-between">
                  <span className="text-[10px] font-black text-zinc-900 uppercase">Total Variável Estimado:</span>
                  <span className="font-black text-indigo-600 text-[11px]">{formatCurrency(totalVariável)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'contract' && (
          <div className="space-y-6">
            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Cargo Atual</p>
              <p className="text-sm font-black text-zinc-900">{employee.role}</p>
              <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1">{employee.departmentName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Salário Base</p>
                <p className="text-lg font-black text-zinc-900">{formatCurrency(employee.salary)}</p>
              </div>
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Admissão</p>
                <p className="text-lg font-black text-zinc-900">{formatDate(employee.hiredAt)}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="py-12 text-center">
            <FileText className="w-12 h-12 text-zinc-100 mx-auto mb-3" />
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nenhum documento anexado</p>
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div className="p-4 bg-zinc-50 border-t border-zinc-100 grid grid-cols-2 gap-2">
        <button className="flex items-center justify-center px-4 py-3 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:bg-zinc-100 transition shadow-sm active:scale-95">
          <Eye className="w-3.5 h-3.5 mr-2 text-zinc-400" />
          Ver Perfil
        </button>
        <button className="flex items-center justify-center px-4 py-3 bg-white border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:bg-zinc-100 transition shadow-sm active:scale-95">
          <Edit className="w-3.5 h-3.5 mr-2 text-zinc-400" />
          Editar
        </button>
        <button className="col-span-2 flex items-center justify-center px-4 py-3 bg-zinc-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition shadow-lg shadow-zinc-900/10 active:scale-95">
          <Calendar className="w-3.5 h-3.5 mr-2" />
          Gerenciar Férias
        </button>
      </div>
    </div>
  );

  if (variant === 'widget') {
    return content;
  }

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-y-0 right-0 w-full max-w-md z-[60]"
    >
      {content}
    </motion.div>
  );
}
