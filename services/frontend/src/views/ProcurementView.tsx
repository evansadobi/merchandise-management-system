import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, Modal, Pill, QuickInput, inputCls } from '../components/ui';
import { api, runAll, summarize } from '../api';

interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
  status: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  status: string;
  paymentTerms: string;
  leadTimeDays: number;
}

interface VendorProduct {
  id: string;
  vendorId: string;
  sku: string;
  unitCost: string;
}

const API = 'http://localhost:3002/api/purchase-orders';
const VENDORS_API = 'http://localhost:3001/api/vendors';

const tone = {
  DRAFT: 'slate',
  APPROVED: 'blue',
  PARTIALLY_RECEIVED: 'yellow',
  RECEIVED: 'green',
} as const;

export default function ProcurementView() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorProducts, setVendorProducts] = useState<VendorProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ vendorId: '', sku: '', quantity: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [approveIds, setApproveIds] = useState<string[] | null>(null);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      setPos(await api<PurchaseOrder[]>(API));
    } catch (e: any) {
      setError(`${e.message} (Is procurement-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const body = await api<{ data: Vendor[] }>(`${VENDORS_API}?limit=100`);
  
      const approved = (body.data ?? []).filter((v) => v.status === 'APPROVED');
      setVendors(approved);
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    load();
    loadVendors();
  }, []);

  useEffect(() => {
    if (!form.vendorId) {
      setVendorProducts([]);
      return;
    }
    setLoadingProducts(true);
    api<VendorProduct[]>(`${VENDORS_API}/${form.vendorId}/products`)
      .then((rows) => setVendorProducts(Array.isArray(rows) ? rows : []))
      .catch(() => setVendorProducts([]))
      .finally(() => setLoadingProducts(false));
  }, [form.vendorId]);

  const selectedVendor = vendors.find((v) => v.id === form.vendorId);
  const selectedProduct = vendorProducts.find((p) => p.sku === form.sku);

  const approve = async (approvedBy: string) => {
    const drafts = (approveIds ?? []).filter(
      (id) => pos.find((p) => p.id === id)?.status === 'DRAFT',
    );
    if (drafts.length === 0) {
      setNotice({ kind: 'error', text: 'Only DRAFT purchase orders can be approved.' });
      return;
    }
    const r = await runAll(drafts, (id) =>
      api(`${API}/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ approvedBy }) }),
    );
    setNotice(summarize(r, 'approved'));
    await load();
  };

  const receive = async (qty: string) => {
    if (!receiving) return;
    try {
      await api(`${API}/${receiving.id}/receive`, {
        method: 'PATCH',
        body: JSON.stringify({ quantityReceived: Number(qty) }),
      });
      setNotice({ kind: 'success', text: `Recorded receipt of ${qty} × ${receiving.sku}.` });
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
    await load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.vendorId) {
      setFormError('Pick a vendor first.');
      return;
    }
    if (!form.sku) {
      setFormError('Pick a SKU approved for this vendor.');
      return;
    }
    try {
      await api(API, {
        method: 'POST',
        body: JSON.stringify({
          vendorId: form.vendorId,
          sku: form.sku,
          quantity: Number(form.quantity),
        }),
      });
      setForm({ vendorId: '', sku: '', quantity: '' });
      setShowCreate(false);
      setNotice({
        kind: 'success',
        text: 'Purchase order created.',
      });
      await load();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const copyId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  const vendorName = (id: string) =>
    vendors.find((v) => v.id === id)?.name ?? `${id.slice(0, 8)}…`;

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortValue: (p) => p.sku,
      render: (p) => <span className="font-medium text-slate-900">{p.sku}</span>,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (p) => (
        <button
          onClick={() => copyId(p.vendorId)}
          title={`Copy ${p.vendorId}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline"
        >
          {vendorName(p.vendorId)}{' '}
          {copied === p.vendorId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      ),
    },
    {
      key: 'qty',
      header: 'Received / Ordered',
      sortValue: (p) => p.quantityOrdered,
      render: (p) => (
        <div className="w-40">
          <div className="mb-1 text-xs">
            {p.quantityReceived} / {p.quantityOrdered}
          </div>
          <div className="h-1.5 rounded-full bg-slate-100">
            <div
              className="h-1.5 rounded-full bg-indigo-500"
              style={{ width: `${Math.min(100, (p.quantityReceived / p.quantityOrdered) * 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'cost',
      header: 'Unit cost',
      align: 'right',
      sortValue: (p) => Number(p.unitCost),
      render: (p) => `KES ${Number(p.unitCost).toLocaleString()}`,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (p) => p.status,
      render: (p) => <Pill tone={tone[p.status]}>{p.status.replace('_', ' ')}</Pill>,
    },
    {
      key: 'created',
      header: 'Created',
      sortValue: (p) => p.createdAt,
      render: (p) => new Date(p.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Purchase orders</h2>
          <p className="text-sm text-slate-500"></p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          disabled={vendors.length === 0}
          title={vendors.length === 0 ? 'Approve a vendor first' : undefined}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + New purchase order
        </button>
      </div>

      {notice && <Banner {...notice} onClose={() => setNotice(null)} />}

      <DataTable
        rows={pos}
        columns={columns}
        rowId={(p) => p.id}
        noun="purchase orders"
        loading={loading}
        error={error}
        searchPlaceholder="Search SKU or vendor"
        searchText={(p) => `${p.sku} ${vendorName(p.vendorId)}`}
        filters={[
          {
            label: 'All statuses',
            options: ['DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'].map((s) => ({
              value: s,
              label: s.replace('_', ' '),
            })),
            predicate: (p, v) => p.status === v,
          },
        ]}
        bulkActions={[{ label: 'Approve', onClick: (ids) => setApproveIds(ids) }]}
        rowActions={(p) =>
          p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED' ? (
            <button
              onClick={() => setReceiving(p)}
              className="text-xs font-semibold text-green-700 hover:underline"
            >
              Receive
            </button>
          ) : null
        }
      />

      {approveIds && (
        <QuickInput
          title="Approve purchase orders"
          label="Approving as"
          defaultValue="Store Manager"
          submitLabel="Approve"
          onSubmit={approve}
          onClose={() => setApproveIds(null)}
        />
      )}
      {receiving && (
        <QuickInput
          title={`Receive ${receiving.sku}`}
          label={`Quantity received (${receiving.quantityOrdered - receiving.quantityReceived} outstanding)`}
          type="number"
          submitLabel="Record receipt"
          onSubmit={receive}
          onClose={() => setReceiving(null)}
        />
      )}

      {showCreate && (
        <Modal title="New purchase order" onClose={() => setShowCreate(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label={`Vendor (${vendors.length} approved)`}>
              <select
                required
                className={inputCls}
                value={form.vendorId}
                onChange={(e) =>
                  // Reset SKU when the vendor changes
                  setForm({ ...form, vendorId: e.target.value, sku: '' })
                }
              >
                <option value="">— Select a vendor —</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {v.paymentTerms} · {v.leadTimeDays}d
                  </option>
                ))}
              </select>
            </Field>

            {selectedVendor && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div>
                  <span className="font-semibold">Terms:</span> {selectedVendor.paymentTerms} ·{' '}
                  <span className="font-semibold">Lead time:</span> {selectedVendor.leadTimeDays} days
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Cost and terms will be locked onto the PO at creation.
                </div>
              </div>
            )}

            <Field label="SKU (approved for this vendor)">
              <select
                required
                disabled={!form.vendorId || loadingProducts}
                className={inputCls}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              >
                <option value="">
                  {!form.vendorId
                    ? '— Pick a vendor first —'
                    : loadingProducts
                      ? 'Loading products…'
                      : vendorProducts.length === 0
                        ? '— No approved products for this vendor —'
                        : '— Select a SKU —'}
                </option>
                {vendorProducts.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} · KES {Number(p.unitCost).toLocaleString()}
                  </option>
                ))}
              </select>
            </Field>

            {form.vendorId && !loadingProducts && vendorProducts.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                This vendor has no approved products yet. Ask Vendor Management to assign
                SKUs before creating a PO.
              </div>
            )}

            {selectedProduct && (
              <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-700">
                <span className="font-semibold">Locked cost:</span> KES{' '}
                {Number(selectedProduct.unitCost).toLocaleString()} per unit
              </div>
            )}

            <Field label="Quantity">
              <input
                required
                type="number"
                min={1}
                className={inputCls}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>

            {selectedProduct && form.quantity && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Estimated total</span>
                  <span className="font-mono font-semibold">
                    KES{' '}
                    {(
                      Number(form.quantity) * Number(selectedProduct.unitCost)
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-red-600">{formError}</span>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Create PO
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}