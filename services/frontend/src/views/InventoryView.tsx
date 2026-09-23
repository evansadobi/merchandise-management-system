import { useEffect, useState } from 'react';

interface InventoryItem {
  id: string;
  sku: string;
  productName: string;
  locationId: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityOnOrder: number;
  unitValue: string;
  reorderLevel: number;
}

const API_BASE = 'http://localhost:3003';

export default function InventoryView() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});
  const [reserveQty, setReserveQty] = useState<Record<string, string>>({});

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    productName: '', sku: '', locationId: '', quantityOnHand: '', unitValue: '', reorderLevel: '',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadInventory = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/inventory`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch inventory from backend');
        return res.json();
      })
      .then((body) => {
        setInventory(body.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: createForm.productName,
          sku: createForm.sku,
          locationId: createForm.locationId || undefined,
          quantityOnHand: createForm.quantityOnHand ? Number(createForm.quantityOnHand) : undefined,
          unitValue: createForm.unitValue || undefined,
          reorderLevel: createForm.reorderLevel ? Number(createForm.reorderLevel) : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setCreateForm({ productName: '', sku: '', locationId: '', quantityOnHand: '', unitValue: '', reorderLevel: '' });
      setShowCreateForm(false);
      loadInventory();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async (sku: string, locationId: string) => {
    const key = `${sku}::${locationId}`;
    const delta = Number(adjustQty[key]);
    if (!delta) {
      setActionError('Enter a non-zero delta first (positive to add, negative to remove).');
      return;
    }
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/sku/${encodeURIComponent(sku)}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, locationId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setAdjustQty({ ...adjustQty, [key]: '' });
      loadInventory();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReserve = async (sku: string, locationId: string) => {
    const key = `${sku}::${locationId}`;
    const quantity = Number(reserveQty[key]);
    if (!quantity || quantity <= 0) {
      setActionError('Enter a positive quantity to reserve first.');
      return;
    }
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/inventory/sku/${encodeURIComponent(sku)}/reserve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, locationId }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setReserveQty({ ...reserveQty, [key]: '' });
      loadInventory();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Control Center</h2>
          <p className="text-sm text-slate-500">Real-time stock tracking, valuations, and distinct quantity metrics.</p>
        </div>
        <button
          onClick={() => setShowCreateForm((v) => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          {showCreateForm ? 'Cancel' : '+ New Inventory Record'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Product Name</label>
            <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.productName} onChange={(e) => setCreateForm({ ...createForm, productName: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">SKU</label>
            <input required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.sku} onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Location (optional)</label>
            <input placeholder="MAIN_WAREHOUSE" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.locationId} onChange={(e) => setCreateForm({ ...createForm, locationId: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Starting Qty On Hand</label>
            <input type="number" min={0} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.quantityOnHand} onChange={(e) => setCreateForm({ ...createForm, quantityOnHand: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Value</label>
            <input placeholder="1.25" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.unitValue} onChange={(e) => setCreateForm({ ...createForm, unitValue: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Reorder Level</label>
            <input type="number" min={0} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={createForm.reorderLevel} onChange={(e) => setCreateForm({ ...createForm, reorderLevel: e.target.value })} />
          </div>
          <div className="col-span-3 flex items-center justify-between">
            {createError && <p className="text-red-600 text-sm">{createError}</p>}
            <button type="submit" disabled={submitting}
              className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Record'}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 mb-4 text-sm">{actionError}</div>
      )}

      {loading && <div className="text-slate-600">Loading inventory stock...</div>}
      {error && <div className="bg-amber-50 text-amber-700 p-4 rounded-lg border border-amber-200">Notice: {error} (Ensure inventory-service is running)</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">SKU / Product</th>
                <th className="p-4">Location</th>
                <th className="p-4 text-center">On Hand</th>
                <th className="p-4 text-center">Allocated</th>
                <th className="p-4 text-center">Available</th>
                <th className="p-4 text-right">Unit Value</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">No inventory records found.</td>
                </tr>
              ) : (
                inventory.map((item) => {
                  const available = item.quantityOnHand - item.quantityAllocated;
                  const isLow = item.quantityOnHand <= item.reorderLevel;
                  const key = `${item.sku}::${item.locationId}`;
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 ${isLow ? 'bg-red-50/40' : ''}`}>
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="text-xs font-mono text-slate-400">{item.sku}</div>
                      </td>
                      <td className="p-4 text-xs text-slate-500">{item.locationId}</td>
                      <td className={`p-4 text-center font-semibold ${isLow ? 'text-red-600' : 'text-slate-900'}`}>
                        {item.quantityOnHand}
                      </td>
                      <td className="p-4 text-center text-amber-600">{item.quantityAllocated}</td>
                      <td className="p-4 text-center font-semibold text-green-600">{available}</td>
                      <td className="p-4 text-right font-mono text-slate-900">
                        KES {Number(item.unitValue).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="±qty"
                              className="w-16 border border-slate-300 rounded px-1 py-0.5 text-xs"
                              value={adjustQty[key] || ''}
                              onChange={(e) => setAdjustQty({ ...adjustQty, [key]: e.target.value })}
                            />
                            <button
                              onClick={() => handleAdjust(item.sku, item.locationId)}
                              className="text-xs font-semibold text-indigo-700 hover:underline"
                            >
                              Adjust
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={1}
                              placeholder="qty"
                              className="w-16 border border-slate-300 rounded px-1 py-0.5 text-xs"
                              value={reserveQty[key] || ''}
                              onChange={(e) => setReserveQty({ ...reserveQty, [key]: e.target.value })}
                            />
                            <button
                              onClick={() => handleReserve(item.sku, item.locationId)}
                              className="text-xs font-semibold text-amber-700 hover:underline"
                            >
                              Reserve
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}