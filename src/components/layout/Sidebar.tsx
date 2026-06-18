import { LayoutDashboard, Users, CreditCard, Box, CheckSquare, Settings, LogOut } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'hr', icon: Users, label: 'Recursos Humanos' },
    { id: 'finance', icon: CreditCard, label: 'Financeiro' },
    { id: 'inventory', icon: Box, label: 'Estoque' },
    { id: 'tasks', icon: CheckSquare, label: 'Tarefas' },
  ];

  return (
    <div className="w-64 bg-zinc-900 text-white h-screen fixed left-0 top-0 flex flex-col border-r border-zinc-800">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          AdminHub Pro
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
        <button className="w-full flex items-center space-x-3 px-4 py-3 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-lg transition-all">
          <Settings className="w-5 h-5 text-zinc-500" />
          <span className="font-medium">Configurações</span>
        </button>
        <button className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
