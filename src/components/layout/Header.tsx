import { Bell, Search, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input 
          type="text" 
          placeholder="Pesquisar em todo o ecossistema..." 
          className="w-full bg-zinc-50 border border-zinc-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans"
        />
      </div>

      <div className="flex items-center space-x-6">
        <div className="hidden md:flex items-center space-x-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Sistemas Sincronizados</span>
        </div>
        <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-full relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full"></span>
        </button>
        <div className="flex items-center space-x-3 pl-4 border-l border-zinc-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-zinc-900 leading-tight">Administrador</p>
            <p className="text-xs text-zinc-500">Gestão Global</p>
          </div>
          <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200">
            <User className="w-6 h-6 text-zinc-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
