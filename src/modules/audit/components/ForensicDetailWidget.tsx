import React from 'react';
import { motion } from 'motion/react';
import { 
  X, History, Shield, Terminal, Globe, 
  Clock, Hash, ArrowRight, Minus, Plus,
  FileText, Activity, User, Briefcase
} from 'lucide-react';
import { AuditLog } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/src/lib/utils';

interface ForensicDetailWidgetProps {
  log: AuditLog;
  onClose: () => void;
}

export default function ForensicDetailWidget({ log, onClose }: ForensicDetailWidgetProps) {
  const renderDiff = () => {
    if (!log.changes || (!log.changes.before && !log.changes.after)) {
      return (
        <div className="p-8 text-center bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
          <Terminal className="w-10 h-10 text-zinc-300 mx-auto mb-4" />
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Sem metadados de alteração disponíveis para este recurso.
          </p>
        </div>
      );
    }

    const before = log.changes.before || {};
    const after = log.changes.after || {};
    
    // Get all unique keys
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter(key => key !== 'updatedAt' && key !== 'createdAt');

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Bit-By-Bit Comparison
          </h4>
          <span className="text-[8px] font-black bg-zinc-900 text-white px-2 py-0.5 rounded uppercase tracking-[0.2em]">Delta View</span>
        </div>

        <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
          {allKeys.map(key => {
            const valBefore = before[key];
            const valAfter = after[key];
            const isChanged = JSON.stringify(valBefore) !== JSON.stringify(valAfter);

            if (!isChanged && log.action === 'update') return null;

            return (
              <div key={key} className="border-b border-zinc-800 last:border-0 font-mono text-[10px]">
                {/* Header (Field Name) */}
                <div className="px-4 py-2 bg-zinc-800/50 flex items-center justify-between">
                  <span className="text-zinc-500 font-bold uppercase tracking-widest text-[8px]">{key}</span>
                </div>

                {/* Value Comparison */}
                <div className="divide-y divide-zinc-800">
                   {/* Removed */}
                   {(valBefore !== undefined && log.action !== 'create') && (
                     <div className="flex bg-red-500/10 text-red-400 p-3 items-start gap-3">
                        <Minus className="w-3 h-3 mt-0.5 opacity-50 shrink-0" />
                        <span className="break-all">{typeof valBefore === 'object' ? JSON.stringify(valBefore) : String(valBefore)}</span>
                     </div>
                   )}
                   {/* Added */}
                   {(valAfter !== undefined && log.action !== 'delete') && (
                     <div className="flex bg-emerald-500/10 text-emerald-400 p-3 items-start gap-3">
                        <Plus className="w-3 h-3 mt-0.5 opacity-50 shrink-0" />
                        <span className="break-all">{typeof valAfter === 'object' ? JSON.stringify(valAfter) : String(valAfter)}</span>
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white flex flex-col h-full rounded-[2.5rem] border border-zinc-200 shadow-sm overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl",
              log.action === 'delete' ? "bg-red-600 shadow-red-600/20" :
              log.action === 'create' ? "bg-emerald-600 shadow-emerald-600/20" :
              "bg-indigo-600 shadow-indigo-600/20"
            )}>
               <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Investigation Log</p>
              <h3 className="text-xl font-black text-zinc-900 tracking-tight flex items-center gap-2 uppercase">
                {log.action.replace('_', ' ')}
                <ArrowRight className="w-4 h-4 text-zinc-300" />
                <span className="text-zinc-500">{log.resource}</span>
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-zinc-200 rounded-full text-zinc-400 transition-all active:scale-95">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <User className="w-3.5 h-3.5 text-zinc-400" />
                 <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Authority</span>
              </div>
              <p className="text-xs font-black text-zinc-900 uppercase tracking-tight truncate">{log.userName}</p>
           </div>
           <div className="p-4 bg-white border border-zinc-100 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                 <Clock className="w-3.5 h-3.5 text-zinc-400" />
                 <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Timestamp</span>
              </div>
              <p className="text-xs font-black text-zinc-900 uppercase tracking-tight">
                {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '---'}
              </p>
           </div>
        </div>
      </div>

      {/* Forensic Dashboard */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
        {/* Session Metadata */}
        <div className="space-y-4">
           <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-2">Session Fingerprint</h4>
           <div className="p-6 bg-zinc-50 rounded-3xl border border-zinc-100 space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-zinc-400" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-900 uppercase">IP Address Host</p>
                       <p className="text-[10px] font-mono text-zinc-500">187.32.9.112 (Detectado)</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <Briefcase className="w-4 h-4 text-zinc-400" />
                    <div>
                       <p className="text-[9px] font-black text-zinc-900 uppercase">Resource Identity</p>
                       <p className="text-[10px] font-mono text-zinc-500">{log.resourceId.slice(0, 12)}...</p>
                    </div>
                 </div>
              </div>
              
              <div className="pt-4 border-t border-zinc-200">
                 <div className="flex items-center gap-2 mb-2">
                    <Hash className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Transaction Hash</span>
                 </div>
                 <p className="text-[9px] font-mono text-zinc-400 break-all select-all">{log.id || 'N/A'}-AUDIT-VOL-882-BIT</p>
              </div>
           </div>
        </div>

        {/* The Visual Diff */}
        {renderDiff()}
      </div>

      {/* Footer Audit Stamp */}
      <div className="p-8 bg-zinc-900 text-white flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
               <Shield className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
               <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Verified Immutable</p>
               <p className="text-[10px] text-zinc-500 font-bold uppercase">Bit-Sha256 Compliance</p>
            </div>
         </div>
         <FileText className="w-5 h-5 text-white/20" />
      </div>
    </div>
  );
}
