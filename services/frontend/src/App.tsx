import { useState } from 'react';
import VendorsView from './views/VendorsView';
import ProcurementView from './views/ProcurementView';
import InventoryView from './views/InventoryView';
import ComingSoonView from './views/ComingSoonView';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vendors' | 'procurement' | 'inventory' | 'coming-soon'>('vendors');
  const [comingSoonTitle, setComingSoonTitle] = useState('');

  const handleSelectComingSoon = (title: string) => {
    setComingSoonTitle(title);
    setActiveTab('coming-soon');
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-lg">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold tracking-wider text-indigo-400">MMS Platform</h1>
          <p className="text-xs text-slate-400 mt-1">Merchandising Management System</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"></p>
          
          <button
            onClick={() => setActiveTab('vendors')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'vendors' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📦 Vendor Portal
          </button>

          <button
            onClick={() => setActiveTab('procurement')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'procurement' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📝 Procurement Dashboard
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'inventory' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            📊 Inventory Control
          </button>

          <div className="pt-6">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Future Phases (Flags)</p>
            
            <button
              onClick={() => handleSelectComingSoon('Warehouse Receiving & Operations')}
              className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              🚚 Receiving & Warehouse 
            </button>
            <button
              onClick={() => handleSelectComingSoon('Retail Sales & POS / Sales Audit')}
              className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              🛍️ Retail POS & Audit 
            </button>
            <button
              onClick={() => handleSelectComingSoon('Financials & Ledger')}
              className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              💰 Financials & Accounting 
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'vendors' && <VendorsView />}
        {activeTab === 'procurement' && <ProcurementView />}
        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'coming-soon' && <ComingSoonView moduleName={comingSoonTitle} />}
      </main>
    </div>
  );
}