import { useEffect, useState } from 'react';

interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
  paymentTerms: string;
  status: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
  createdAt: string;
}

const API_BASE = 'http://localhost:3002';

export default function ProcurementView() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approverName, setApproverName] = useState('Store Manager');
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const [form, setForm] = useState({ vendorId: '', sku: '', quantity: '' });

  const loadPOs = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/purchase-orders`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch purchase orders from backend');
        return res.json();
      })
      .then((data) => {
        setPos(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPOs();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: form.vendorId,
          sku: form.sku,
          quantity: Number(form.quantity),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setForm({ vendorId: '', sku: '', quantity: '' });
      setShowForm(false);
      loadPOs();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: approverName || 'Unknown' }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      loadPOs();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReceive = async (id: string) => {
    const qty = Number(receiveQty[id]);
    if (!qty || qty <= 0) {
      setActionError('Enter a valid quantity to receive first.');
      return;
    }
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/purchase-orders/${id}/receive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantityReceived: qty }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setReceiveQty({ ...receiveQty, [id]: '' });
      loadPOs();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const statusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'APPROVED': return 'bg-blue-100 text-blue-700';
      case 'RECEIVED': return 'bg-green-100 text-green-700';
      case 'PARTIALLY_RECEIVED': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Procurement Dashboard</h2>
          <p className="text-sm text-slate-500">Manage purchase orders, lock in costs, and enforce approvals.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          {showForm ? 'Cancel' : '+ Create Purchase Order'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Vendor ID</label>
            <input
              required
              placeholder="UUID from Vendor Portal"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">SKU</label>
            <input
              required
              placeholder="Must be an approved product for this vendor"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity</label>
            <input
              required
              type="number"
              min={1}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>
          <div className="col-span-3 flex items-center justify-between">
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create PO'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs font-semibold text-slate-500">Approving as:</label>
        <input
          value={approverName}
          onChange={(e) => setApproverName(e.target.value)}
          className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-48"
        />
      </div>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 mb-4 text-sm">{actionError}</div>
      )}

      {loading && <div className="text-slate-600">Loading purchase orders...</div>}
      {error && <div className="bg-amber-50 text-amber-700 p-4 rounded-lg border border-amber-200">Notice: {error} (Ensure procurement-service is running)</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">SKU</th>
                <th className="p-4">Vendor ID</th>
                <th className="p-4">Qty (Ordered / Received)</th>
                <th className="p-4">Unit Cost</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">No purchase orders found.</td>
                </tr>
              ) : (
                pos.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-900">{po.sku}</td>
                    <td className="p-4 font-mono text-xs text-slate-500">{po.vendorId}</td>
                    <td className="p-4">{po.quantityReceived} / {po.quantityOrdered}</td>
                    <td className="p-4 font-semibold text-slate-900">KES {Number(po.unitCost).toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge(po.status)}`}>
                        {po.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {po.status === 'DRAFT' && (
                        <button
                          onClick={() => handleApprove(po.id)}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Approve
                        </button>
                      )}
                      {(po.status === 'APPROVED' || po.status === 'PARTIALLY_RECEIVED') && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            placeholder="qty"
                            className="w-16 border border-slate-300 rounded px-1 py-0.5 text-xs"
                            value={receiveQty[po.id] || ''}
                            onChange={(e) => setReceiveQty({ ...receiveQty, [po.id]: e.target.value })}
                          />
                          <button
                            onClick={() => handleReceive(po.id)}
                            className="text-xs font-semibold text-green-700 hover:underline"
                          >
                            Receive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}