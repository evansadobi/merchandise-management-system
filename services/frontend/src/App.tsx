import { useState } from 'react';
import { Layout, type ViewKey } from './components/Layout';
import VendorsView from './views/VendorsView';
import ProcurementView from './views/ProcurementView';
import ReceivingView from './views/ReceivingView';
import InventoryView from './views/InventoryView';
import WarehouseView from './views/WarehouseView';
import POSTerminalView from './views/POSTerminalView';
import RetailSalesView from './views/RetailSalesView';
import FinancialsView from './views/FinancialsView';

export default function App() {
  const [activeView, setActiveView] = useState<ViewKey>('vendors');

  const renderView = () => {
    switch (activeView) {
      case 'vendors':
        return <VendorsView />;
      case 'procurement':
        return <ProcurementView />;
      case 'receiving':
        return <ReceivingView />;
      case 'inventory':
        return <InventoryView />;
      case 'warehouse':
        return <WarehouseView />;
      case 'pos':
        return <POSTerminalView />;
      case 'audit':
        return <RetailSalesView />;
      case 'finance':
        return <FinancialsView />;
      default:
        return <VendorsView />;
    }
  };

  return (
    <Layout activeView={activeView} onSelect={setActiveView}>
      {renderView()}
    </Layout>
  );
}