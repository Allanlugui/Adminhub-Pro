import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserPlus, Briefcase, CreditCard, ShieldCheck, CheckCircle2, ChevronRight, ChevronLeft, MapPin, Phone, Mail, User } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { UserRole } from '@/src/types';

interface OnboardingFlowProps {
  onComplete: (data: any) => void;
  onCancel: () => void;
}

export default function OnboardingFlow({ onComplete, onCancel }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    documentId: '',
    role: '',
    departmentName: 'Administrativo',
    departmentId: 'admin-001',
    salary: 0,
    address: '',
    benefits: {
      healthPlan: true,
      dentalPlan: false,
      mealVoucher: 600,
      transportVoucher: true,
    },
    systemAccess: false,
    systemRole: 'OPERATOR' as UserRole
  });

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const steps = [
    { id: 1, label: 'Identificação', icon: User },
    { id: 2, label: 'Contrato', icon: Briefcase },
    { id: 3, label: 'Benefícios', icon: CreditCard },
    { id: 4, label: 'Acesso', icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Stepper */}
      <div className="flex items-center justify-between px-8 py-6 bg-zinc-50 border-b border-zinc-200">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                step === s.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50" :
                step > s.id ? "bg-emerald-500 text-white" : "bg-zinc-200 text-zinc-500"
              )}>
                {step > s.id ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              <span className={cn("text-[10px] font-black uppercase tracking-widest", step === s.id ? "text-indigo-600" : "text-zinc-400")}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 max-w-[40px] mb-6", step > s.id ? "bg-emerald-500" : "bg-zinc-200")} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Nome Completo</label>
                  <input 
                    required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Alexandre de Moraes"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Corporativo</label>
                  <input 
                    required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="colaborador@empresa.com"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Telefone</label>
                  <input 
                    type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="(11) 98888-7777"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Documento ID (CPF)</label>
                  <input 
                    type="text" value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Endereço Completo</label>
                  <input 
                    type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}
                    placeholder="Rua, Número, Bairro, Cidade - UF"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Cargo</label>
                  <input 
                    required type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                    placeholder="Ex: Analista de Operações"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Departamento</label>
                  <select 
                    value={formData.departmentName} 
                    onChange={e => setFormData({...formData, departmentName: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  >
                    <option>Administrativo</option>
                    <option>Financeiro</option>
                    <option>TI</option>
                    <option>Logística</option>
                    <option>Vendas</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Salário Base (Bruto)</label>
                  <input 
                    required type="number" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: 'healthPlan', label: 'Plano de Saúde', icon: UserPlus },
                  { id: 'dentalPlan', label: 'Plano Odontológico', icon: ShieldCheck },
                  { id: 'transportVoucher', label: 'Vale Transporte', icon: MapPin },
                ].map((b) => (
                  <label key={b.id} className={cn(
                    "flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all",
                    (formData.benefits as any)[b.id] ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm" : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300"
                  )}>
                    <input 
                      type="checkbox" 
                      checked={(formData.benefits as any)[b.id]} 
                      onChange={e => setFormData({...formData, benefits: {...formData.benefits, [b.id]: e.target.checked}})}
                      className="hidden"
                    />
                    <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all", (formData.benefits as any)[b.id] ? "bg-indigo-600 border-indigo-600 text-white" : "border-zinc-200")}>
                      {(formData.benefits as any)[b.id] && <CheckCircle2 className="w-3 h-3" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-tight">{b.label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Valor Vale Refeição (Mensal)</label>
                <input 
                  type="number" value={formData.benefits.mealVoucher} onChange={e => setFormData({...formData, benefits: {...formData.benefits, mealVoucher: Number(e.target.value)}})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/5 outline-none"
                />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl space-y-4">
                 <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-indigo-600" />
                    <div>
                       <h4 className="text-sm font-black text-indigo-900 uppercase">Configuração de Acesso</h4>
                       <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Contas de Sistema e RBAC</p>
                    </div>
                 </div>

                 <label className="flex items-center gap-3 cursor-pointer p-4 bg-white/50 rounded-2xl">
                    <input 
                      type="checkbox" 
                      checked={formData.systemAccess} 
                      onChange={e => setFormData({...formData, systemAccess: e.target.checked})}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                    <div>
                       <p className="text-xs font-black text-indigo-900 uppercase">Habilitar Acesso ao AdminHub</p>
                       <p className="text-[10px] text-indigo-600 font-medium">Gera credenciais automáticas sincronizadas com o RH.</p>
                    </div>
                 </label>

                 {formData.systemAccess && (
                   <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">Nível de Permissão (Role)</label>
                      <select 
                        value={formData.systemRole} 
                        onChange={e => setFormData({...formData, systemRole: e.target.value as any})}
                        className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/20 outline-none"
                      >
                         <option value="OPERATOR">Operator (Funcionalidades Básicas)</option>
                         <option value="MANAGER">Manager (Gestão de Departamento)</option>
                         <option value="ADMIN">Admin (Acesso Global)</option>
                      </select>
                   </div>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="px-8 py-6 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
        <button 
          onClick={step === 1 ? onCancel : prevStep}
          className="px-6 py-3 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-zinc-700 flex items-center gap-2"
        >
          {step === 1 ? 'Cancelar' : <><ChevronLeft className="w-4 h-4" /> Voltar</>}
        </button>
        <button 
          onClick={step === 4 ? () => onComplete(formData) : nextStep}
          className="bg-zinc-900 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-zinc-900/10"
        >
          {step === 4 ? 'Confirmar Admissão' : <>Próximo <ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
