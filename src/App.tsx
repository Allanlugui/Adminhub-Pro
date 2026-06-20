/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth } from '@/src/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db } from '@/src/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './modules/dashboard/Dashboard';
import HRModule from './modules/hr/HRModule';
import FinanceModule from './modules/finance/FinanceModule';
import InventoryModule from './modules/inventory/InventoryModule';
import TicketsModule from './modules/tickets/TicketsModule';
import AuditModule from './modules/audit/AuditModule';
import UsersModule from './modules/users/UsersModule';
import SettingsModule from './modules/settings/SettingsModule';
import SetupModule from './modules/setup/SetupModule';
import Login from './components/auth/Login';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const docRef = doc(db, 'users', u.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile({
              uid: u.uid,
              email: u.email || '',
              role: 'ADMIN',
              displayName: u.displayName || u.email?.split('@')[0] || 'Gestor',
            });
          }
        } catch (fetchError) {
          console.error("Erro ao carregar o perfil do Firestore, aplicando perfil padrão:", fetchError);
          setProfile({
            uid: u.uid,
            email: u.email || '',
            role: 'ADMIN',
            displayName: u.displayName || u.email?.split('@')[0] || 'Gestor',
          });
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'hr': return <HRModule />;
      case 'finance': return <FinanceModule />;
      case 'inventory': return <InventoryModule />;
      case 'tickets': return <TicketsModule />;
      case 'audit': return <AuditModule />;
      case 'users': return <UsersModule />;
      case 'settings': return <SettingsModule />;
      case 'setup': return profile?.role === 'ADMIN' ? <SetupModule /> : <Dashboard />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-blue-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userProfile={profile} />
      
      <main className="pl-64 flex flex-col min-h-screen">
        <Header />
        
        <div className="p-8 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
