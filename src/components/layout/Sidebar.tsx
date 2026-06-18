import { LayoutDashboard, Users, CreditCard, Box, CheckSquare, Settings, LogOut, ShieldCheck, LifeBuoy, Database } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { UserProfile } from '@/src/types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userProfile: UserProfile | null;
}

export default function Sidebar({ activeTab, setActiveTab, userProfile }: SidebarProps) {
  const handleLogout = () => {
    if (confirm('Deseja realmente encerrar a sessão?')) {
      signOut(auth);
    }
  };

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'hr', icon: Users, label: 'Recursos Humanos' },
    { id: 'finance', icon: CreditCard, label: 'Financeiro' },
    { id: 'inventory', icon: Box, label: 'Estoque' },
    { id: 'tickets', icon: LifeBuoy, label: 'Central de Serviços' },
    { id: 'users', icon: ShieldCheck, label: 'Usuários & Acesso' },
    { id: 'audit', icon: ShieldCheck, label: 'Logs de Auditoria' },
  ];

  if (userProfile?.role === 'ADMIN') {
    menuItems.push({ id: 'setup', icon: Database, label: 'Setup de Lançamento' });
  }

  return (
    <div className="w-64 bg-zinc-900 text-white h-screen fixed left-0 top-0 flex flex-col border-r border-zinc-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          AdminHub Enterprise
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group",
              activeTab === item.id 
                ? "bg-blue-600/20 text-blue-400 ring-1 ring-blue-500/50" 
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-300")} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-zinc-800 space-y-1">
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all",
            activeTab === 'settings' 
              ? "bg-zinc-800 text-zinc-200" 
              : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          )}
        >
          <Settings className="w-5 h-5 text-zinc-500" />
          <span className="font-medium">Configurações</span>
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
