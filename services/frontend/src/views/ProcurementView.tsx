import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, CircleDollarSign, ClipboardList, Copy, PackageCheck, PackageOpen } from 'lucide-react';
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

const API = `${import.meta.env.VITE_PROCUREMENT_API ?? 'http://localhost:3002'}/api/purchase-orders`;
const VENDORS_API = `${import.meta.env.VITE_VENDOR_API ?? 'http://localhost:3001'}/api/vendors`;

const tone = {
  DRAFT: 'slate',
  APPROVED: 'blue',
  PARTIALLY_RECEIVED: 'yellow',
  RECEIVED: 'green',
} as const;

const shortPoRef = (id: string) => `PO-${id.slice(0, 8).toUpperCase()}`;
const formatStatus = (status: PurchaseOrder['status']) =>
  ({
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    PARTIALLY_RECEIVED: 'Part received',
    RECEIVED: 'Received',
  }[status]);

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

  const loadPurchaseOrders = async () => {
    try {
      setError(null);
      const body = await api<PurchaseOrder[] | { data: PurchaseOrder[] }>(API);
      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
      setPos(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setError(`${message} (Is procurement-service running?)`);
      setPos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const body = await api<{ data: Vendor[] } | Vendor[]>(`${VENDORS_API}?limit=100`);
      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];
      const approved = rows.filter((vendor) => vendor.status === 'APPROVED');
      setVendors(approved);
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    void loadPurchaseOrders();
    void loadVendors();
  }, []);

  useEffect(() => {
    if (!form.vendorId) {
      setVendorProducts([]);
      setForm((current) => ({ ...current, sku: '' }));
      return;
    }

    setLoadingProducts(true);
    api<VendorProduct[] | { data: VendorProduct[] }>(`${VENDORS_API}/${form.vendorId}/products`)
      .then((rows) => {
        const nextProducts = Array.isArray(rows)
          ? rows
          : Array.isArray(rows?.data)
            ? rows.data
            : [];
        setVendorProducts(nextProducts);
        if (form.sku && !nextProducts.some((product) => product.sku === form.sku)) {
          setForm((current) => ({ ...current, sku: '' }));
        }
      })
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
      setNotice({ kind: 'error', text: 'Only draft purchase orders can be approved.' });
      return;
    }
    const r = await runAll(drafts, (id) =>
      api(`${API}/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ approvedBy }) }),
    );
    setNotice(summarize(r, 'approved'));
    await loadPurchaseOrders();
  };

  const receive = async (qty: string) => {
    if (!receiving) return;

    const nextQuantity = Number(qty);
    const remaining = Math.max(0, receiving.quantityOrdered - receiving.quantityReceived);

    if (!Number.isInteger(nextQuantity) || nextQuantity <= 0) {
      setNotice({ kind: 'error', text: 'Quantity received must be a positive integer.' });
      return;
    }

    if (nextQuantity > remaining) {
      setNotice({ kind: 'error', text: `${shortPoRef(receiving.id)}: only ${remaining} unit(s) remain open for ${receiving.sku}.` });
      return;
    }

    try {
      await api(`${API}/${receiving.id}/receive`, {
        method: 'PATCH',
        body: JSON.stringify({ quantityReceived: nextQuantity }),
      });
      setNotice({ kind: 'success', text: `Recorded ${nextQuantity} units for ${receiving.sku}.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record receipt';
      const shortMessage = message.replace(/Purchase order\s+([a-f0-9-]{36})/gi, (_, id: string) => shortPoRef(id));
      setNotice({ kind: 'error', text: shortMessage });
    }
    await loadPurchaseOrders();
  };

  const create = async (e: FormEvent<HTMLFormElement>) => {
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

    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFormError('Quantity must be a positive integer.');
      return;
    }

    try {
      await api(API, {
        method: 'POST',
        body: JSON.stringify({
          vendorId: form.vendorId,
          sku: form.sku,
          quantity,
        }),
      });
      setForm({ vendorId: '', sku: '', quantity: '' });
      setShowCreate(false);
      setNotice({
        kind: 'success',
        text: 'Purchase order created successfully.',
      });
      await loadPurchaseOrders();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create purchase order';
      setFormError(message);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch {
      setCopied(null);
    }
  };

  const vendorName = (id: string) =>
    vendors.find((v) => v.id === id)?.name ?? `${id.slice(0, 8)}…`;

  const metrics = [
    {
      label: 'Total POs',
      value: String(pos.length),
      tone: 'slate',
      icon: ClipboardList,
    },
    {
      label: 'Draft',
      value: String(pos.filter((item) => item.status === 'DRAFT').length),
      tone: 'slate',
      icon: PackageOpen,
    },
    {
      label: 'Approved',
      value: String(pos.filter((item) => item.status === 'APPROVED').length),
      tone: 'blue',
      icon: PackageCheck,
    },
    {
      label: 'Value',
      value: `KES ${pos.reduce((sum, item) => sum + Number(item.unitCost) * item.quantityOrdered, 0).toLocaleString()}`,
      tone: 'green',
      icon: CircleDollarSign,
    },
  ];

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'sku',
      header: 'SKU',
      sortValue: (p) => p.sku,
      render: (p) => <span className="font-medium text-slate-900">{p.sku}</span>,
    },
    {
      key: 'po',
      header: 'PO',
      sortValue: (p) => p.id,
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-slate-700">{shortPoRef(p.id)}</span>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor',
      render: (p) => (
        <button
          onClick={() => copyId(p.vendorId)}
          title={`Copy ${p.vendorId}`}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-indigo-600 hover:bg-slate-100"
        >
          {vendorName(p.vendorId)}{' '}
          {copied === p.vendorId ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      ),
    },
    {
      key: 'qty',
      header: 'Received so far / still open',
      sortValue: (p) => p.quantityOrdered,
      render: (p) => {
        const remaining = Math.max(0, p.quantityOrdered - p.quantityReceived);
        return (
          <div className="w-44">
            <div className="mb-1 text-xs font-medium text-slate-600">
              {p.quantityReceived} received · {remaining} still open
            </div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div
                className="h-1.5 rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, (p.quantityReceived / p.quantityOrdered) * 100)}%` }}
              />
            </div>
          </div>
        );
      },
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
      render: (p) => <Pill tone={tone[p.status]}>{formatStatus(p.status)}</Pill>,
    },
    {
      key: 'created',
      header: 'Created',
      sortValue: (p) => p.createdAt,
      render: (p) => new Date(p.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Procurement</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Purchase orders</h2>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={vendors.length === 0}
            title={vendors.length === 0 ? 'Approve a supplier first' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUpRight className="h-4 w-4" />
            New PO
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const accentStyles = {
            slate: 'bg-slate-100 text-slate-700',
            blue: 'bg-blue-100 text-blue-700',
            green: 'bg-emerald-100 text-emerald-700',
          }[metric.tone as 'slate' | 'blue' | 'green'];

          return (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
                </div>
                <div className={`rounded-xl p-2 ${accentStyles}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {notice && <Banner {...notice} onClose={() => setNotice(null)} />}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <DataTable
          rows={pos}
          columns={columns}
          rowId={(p) => p.id}
          noun="purchase orders"
          loading={loading}
          error={error}
          searchPlaceholder="Search SKU or supplier"
          searchText={(p) => `${p.sku} ${vendorName(p.vendorId)}`}
          filters={[
            {
              label: 'All statuses',
              options: ['DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'].map((s) => ({
                value: s,
                label: formatStatus(s as PurchaseOrder['status']),
              })),
              predicate: (p, v) => p.status === v,
            },
          ]}
          bulkActions={[{ label: 'Approve draft POs', onClick: (ids) => setApproveIds(ids) }]}
          rowActions={(p) =>
            p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED' ? (
              <button
                onClick={() => setReceiving(p)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Receive
              </button>
            ) : null
          }
        />
      </div>

      {approveIds && (
        <QuickInput
          title="Approve draft purchase orders"
          label="Approved by"
          defaultValue="Store Manager"
          submitLabel="Approve"
          onSubmit={approve}
          onClose={() => setApproveIds(null)}
        />
      )}
      {receiving && (
        <QuickInput
          title={`${receiving.sku} — receive against ${shortPoRef(receiving.id)}`}
          label={`Units to receive now (still open: ${Math.max(0, receiving.quantityOrdered - receiving.quantityReceived)})`}
          type="number"
          submitLabel="Save receipt"
          onSubmit={receive}
          onClose={() => setReceiving(null)}
        />
      )}

      {showCreate && (
        <Modal title="Create purchase order" onClose={() => setShowCreate(false)}>
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
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">Locked cost</span>
                  <span className="font-mono font-semibold">KES {Number(selectedProduct.unitCost).toLocaleString()} / unit</span>
                </div>
                {form.quantity && (
                  <div className="mt-2 flex items-center justify-between gap-3 border-t border-indigo-100 pt-2">
                    <span className="font-semibold">Order value</span>
                    <span className="font-mono font-semibold">
                      KES {(Number(form.quantity) * Number(selectedProduct.unitCost)).toLocaleString()}
                    </span>
                  </div>
                )}
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