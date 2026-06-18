import React, { useState, useEffect } from 'react';
import { db, auth } from '@/src/lib/firebase';
import { collection, query, onSnapshot, orderBy, where, updateDoc, doc, limit } from 'firebase/firestore';
import { AppNotification } from '@/src/types';
import { Bell, Check, ExternalLink, X, DollarSign, LifeBuoy, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listen to personal notifications or role-based ones
    // For simplicity, we listen to all notifications and filter on status for now
    // In production, we'd use roles once the user profile is loaded
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      setNotifications(docs);
      setUnreadCount(docs.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'finance': return <DollarSign className="w-4 h-4 text-emerald-500" />;
      case 'ticket': return <LifeBuoy className="w-4 h-4 text-indigo-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-full transition-all relative outline-none",
          isOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 border-2 border-white rounded-full animate-bounce"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notificações
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black rounded-full uppercase tracking-tighter">
                    {unreadCount} Novas
                  </span>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={cn(
                        "p-4 border-b border-zinc-50 transition-colors last:border-0",
                        !notif.read ? "bg-blue-50/30" : "hover:bg-zinc-50"
                      )}
                    >
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-1">
                          {getIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-900 line-clamp-2">{notif.title}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{notif.message}</p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-[9px] font-medium text-zinc-400">
                              {notif.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!notif.read && (
                              <button 
                                onClick={() => markAsRead(notif.id!)}
                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Lida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100">
                      <Bell className="w-6 h-6 text-zinc-200" />
                    </div>
                    <p className="text-zinc-400 text-xs font-semibold">Tudo em dia por aqui.</p>
                  </div>
                )}
              </div>

              <div className="p-3 bg-zinc-50 border-t border-zinc-100 text-center">
                <button className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hover:text-zinc-600 transition-colors">
                  Limpar Todas
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
