import { useState, type ComponentType, type ReactNode } from 'react';
import {
  Users,
  ClipboardList,
  Package,
  Truck,
  Warehouse,
  ShoppingCart,
  Landmark,
} from 'lucide-react';
import VendorsView from './views/VendorsView';
import ProcurementView from './views/ProcurementView';
import InventoryView from './views/InventoryView';
import ReceivingView from './views/ReceivingView';
import WarehouseView from './views/WarehouseView';
import ComingSoonView from './views/ComingSoonView';

type Tab = 'vendors' | 'procurement' | 'inventory' | 'receiving' | 'warehouse' | 'coming-soon';

const live: { id: Exclude<Tab, 'coming-soon'>; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { id: 'vendors', label: 'Vendors', Icon: Users },
  { id: 'procurement', label: 'Procurement', Icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', Icon: Package },
  { id: 'receiving', label: 'Receiving', Icon: Truck },
  { id: 'warehouse', label: 'Warehouse', Icon: Warehouse },
];

const future: { title: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { title: 'Retail Sales & POS / Sales Audit', label: 'Retail POS & Audit (Phase 3)', Icon: ShoppingCart },
  { title: 'Financials & Ledger', label: 'Financials (Phase 4)', Icon: Landmark },
];

function NavButton(props: {
  label: string;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={props.onClick}
      aria-label={props.label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
        props.active
          ? 'bg-indigo-600 text-white'
          : props.muted
            ? 'text-slate-600 hover:bg-slate-800 hover:text-slate-300'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {props.children}
      <span className="pointer-events-none absolute left-12 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg group-hover:opacity-100">
        {props.label}
      </span>
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('vendors');
  const [comingSoon, setComingSoon] = useState('');

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      <aside className="flex w-16 flex-col items-center gap-2 bg-slate-950 py-4">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-lg font-bold text-white">
          M
        </div>
        {live.map(({ id, label, Icon }) => (
          <NavButton key={id} label={label} active={tab === id} onClick={() => setTab(id)}>
            <Icon className="h-5 w-5" />
          </NavButton>
        ))}
        <div className="my-2 h-px w-8 bg-slate-800" />
        {future.map(({ title, label, Icon }) => (
          <NavButton
            key={title}
            label={label}
            muted
            active={tab === 'coming-soon' && comingSoon === title}
            onClick={() => {
              setComingSoon(title);
              setTab('coming-soon');
            }}
          >
            <Icon className="h-5 w-5" />
          </NavButton>
        ))}
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {tab === 'vendors' && <VendorsView />}
        {tab === 'procurement' && <ProcurementView />}
        {tab === 'inventory' && <InventoryView />}
        {tab === 'receiving' && <ReceivingView />}
        {tab === 'warehouse' && <WarehouseView />}
        {tab === 'coming-soon' && <ComingSoonView moduleName={comingSoon} />}
      </main>
    </div>
  );
}