/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './modules/dashboard/Dashboard';
import HRModule from './modules/hr/HRModule';
import FinanceModule from './modules/finance/FinanceModule';
import InventoryModule from './modules/inventory/InventoryModule';
import TasksModule from './modules/tasks/TasksModule';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'hr': return <HRModule />;
      case 'finance': return <FinanceModule />;
      case 'inventory': return <InventoryModule />;
      case 'tasks': return <TasksModule />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-blue-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
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
    </div>
  );
}
