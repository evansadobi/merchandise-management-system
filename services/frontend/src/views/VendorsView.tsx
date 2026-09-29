import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Check, Package, Pencil, Trash2 } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, Modal, Pill, inputCls } from '../components/ui';
import { api, runAll, summarize } from '../api';

interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'ARCHIVED';
}

interface VendorProduct {
  id: string;
  vendorId: string;
  sku: string;
  unitCost: string;
  createdAt: string;
  updatedAt: string;
}

const API = 'http://localhost:3001/api/vendors';
const tone = { APPROVED: 'green', PENDING: 'yellow', SUSPENDED: 'red', ARCHIVED: 'slate' } as const;

const empty = {
  name: '',
  contactEmail: '',
  contactPhone: '',
  paymentTerms: '',
  leadTimeDays: '',
  status: 'PENDING' as 'PENDING' | 'APPROVED',
  approvedBy: '',
};

const nextStates: Record<Vendor['status'], { label: string; status: Vendor['status'] }[]> = {
  PENDING: [
    { label: 'Approve', status: 'APPROVED' },
    { label: 'Suspend', status: 'SUSPENDED' },
  ],
  APPROVED: [
    { label: 'Suspend', status: 'SUSPENDED' },
    { label: 'Archive', status: 'ARCHIVED' },
  ],
  SUSPENDED: [
    { label: 'Approve', status: 'APPROVED' },
    { label: 'Archive', status: 'ARCHIVED' },
  ],
  ARCHIVED: [],
};

export default function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [managingProducts, setManagingProducts] = useState<Vendor | null>(null);
  const [statusMenu, setStatusMenu] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const body = await api<{ data: Vendor[] }>(`${API}?limit=100`);
      setVendors(body.data);
    } catch (e: any) {
      setError(`${e.message} (Is vendor-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!statusMenu) return;
    const close = () => setStatusMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [statusMenu]);

  const changeStatus = async (vendor: Vendor, newStatus: Vendor['status']) => {
    setStatusMenu(null);
    try {
      await api(`${API}/${vendor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setNotice({ kind: 'success', text: `${vendor.name} → ${newStatus}` });
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const bulkStatus = (status: Vendor['status']) => async (ids: string[]) => {
    const r = await runAll(ids, (id) => api(`${API}/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }));
    setNotice(summarize(r, 'updated'));
    await load();
  };

  const bulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} vendor(s)? This cannot be undone.`)) return;
    const r = await runAll(ids, (id) => api(`${API}/${id}`, { method: 'DELETE' }));
    setNotice(summarize(r, 'deleted'));
    await load();
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation for the "Approved" path
    if (form.status === 'APPROVED' && !form.approvedBy.trim()) {
      setFormError('Approved by is required when creating as APPROVED.');
      return;
    }

    try {
      const created = await api<Vendor>(API, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          paymentTerms: form.paymentTerms,
          leadTimeDays: Number(form.leadTimeDays),
        }),
      });

      if (form.status === 'APPROVED' && created?.id) {
        await api(`${API}/${created.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'APPROVED',
          }),
        });
      }

      setForm(empty);
      setShowCreate(false);
      setNotice({
        kind: 'success',
        text:
          form.status === 'APPROVED'
            ? `${form.name} created and approved by ${form.approvedBy}.`
            : `${form.name} created as PENDING. Approve it before Procurement can use it.`,
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

  const columns: Column<Vendor>[] = [
    {
      key: 'name',
      header: 'Supplier',
      sortValue: (v) => v.name.toLowerCase(),
      render: (v) => (
        <div>
          <div className="font-medium text-slate-900">{v.name}</div>
          <div className="text-xs text-slate-400">{v.contactEmail}</div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', render: (v) => v.contactPhone },
    { key: 'terms', header: 'Payment terms', sortValue: (v) => v.paymentTerms, render: (v) => v.paymentTerms },
    { key: 'lead', header: 'Lead time', sortValue: (v) => v.leadTimeDays, render: (v) => `${v.leadTimeDays} days` },
    {
      key: 'id',
      header: 'ID',
      render: (v) => (
        <button
          onClick={() => copyId(v.id)}
          title={`Copy ${v.id}`}
          className="inline-flex items-center gap-1 font-mono text-xs text-indigo-600 hover:underline"
        >
          {v.id.slice(0, 8)}… {copied === v.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (v) => v.status,
      render: (v) => {
        const options = nextStates[v.status];
        const isMenuOpen = statusMenu === v.id;
        return (
          <div className="relative inline-block">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStatusMenu(isMenuOpen ? null : v.id);
              }}
              className="inline-flex items-center gap-1 hover:opacity-80"
              title={options.length > 0 ? 'Change status' : 'Terminal state'}
            >
              <Pill tone={tone[v.status]}>{v.status}</Pill>
              {options.length > 0 && <span className="text-slate-400 text-[10px]">▾</span>}
            </button>

            {isMenuOpen && options.length > 0 && (
              <div
                className="absolute right-0 top-full z-40 mt-1 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {options.map((opt) => (
                  <button
                    key={opt.status}
                    onClick={() => changeStatus(v, opt.status)}
                    className="block w-full px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vendors</h2>
          <p className="text-sm text-slate-500">Suppliers and their terms.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          + New vendor
        </button>
      </div>

      {notice && <Banner {...notice} onClose={() => setNotice(null)} />}

      <DataTable
        rows={vendors}
        columns={columns}
        rowId={(v) => v.id}
        noun="vendors"
        loading={loading}
        error={error}
        searchPlaceholder="Search vendor name or email"
        searchText={(v) => `${v.name} ${v.contactEmail}`}
        filters={[{
          label: 'All statuses',
          options: ['PENDING', 'APPROVED', 'SUSPENDED', 'ARCHIVED'].map((s) => ({ value: s, label: s })),
          predicate: (v, val) => v.status === val,
        }]}
        bulkActions={[
          { label: 'Approve', onClick: bulkStatus('APPROVED') },
          { label: 'Suspend', onClick: bulkStatus('SUSPENDED') },
          { label: 'Delete', tone: 'danger', onClick: bulkDelete },
        ]}
        rowActions={(v) => (
          <div className="flex items-center justify-end gap-2">
            <button
              title="Edit vendor"
              onClick={() => {/* edit modal — later */}}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              title="Manage products"
              onClick={() => setManagingProducts(v)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Package className="h-3.5 w-3.5" />
            </button>
            <button
              title="Delete vendor"
              onClick={() => {
                if (confirm(`Delete ${v.name}?`)) bulkDelete([v.id]);
              }}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      />

      {showCreate && (
        <Modal title="New vendor" onClose={() => setShowCreate(false)}>
          <form onSubmit={create} className="grid grid-cols-2 gap-4">
            <Field label="Name">
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <input required type="email" className={inputCls} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </Field>
            <Field label="Contact phone">
              <input required placeholder="+254712345678" className={inputCls} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </Field>
            <Field label="Payment terms">
              <input required placeholder="Net 30" className={inputCls} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />
            </Field>
            <Field label="Lead time (days)">
              <input required type="number" min={0} className={inputCls} value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
            </Field>
            <Field label="Initial status">
              <select
                className={inputCls}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'PENDING' | 'APPROVED' })}
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
              </select>
            </Field>

            {form.status === 'APPROVED' && (
              <div className="col-span-2">
                <Field label="Approved by">
                  <input
                    required
                    className={inputCls}
                    placeholder="e.g. Store Manager"
                    value={form.approvedBy}
                    onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}
                  />
                </Field>
              </div>
            )}

            <div className="col-span-2 flex items-center justify-between">
              <span className="text-sm text-red-600">{formError}</span>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                Create vendor
              </button>
            </div>
          </form>
        </Modal>
      )}

      {managingProducts && (
        <ProductsModal
          vendor={managingProducts}
          onClose={() => setManagingProducts(null)}
          onChanged={() => { /* no-op */ }}
        />
      )}
    </div>
  );
}


function ProductsModal({
  vendor,
  onClose,
  onChanged,
}: {
  vendor: Vendor;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [newSku, setNewSku] = useState('');
  const [newCost, setNewCost] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setError(null);
      const rows = await api<VendorProduct[]>(`${API}/${vendor.id}/products`);
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [vendor.id]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSku.trim()) {
      setNotice({ kind: 'error', text: 'SKU is required.' });
      return;
    }
    setAdding(true);
    try {
      await api(`${API}/${vendor.id}/products`, {
        method: 'POST',
        body: JSON.stringify({ sku: newSku.trim(), unitCost: newCost.trim() || '0' }),
      });
      setNewSku('');
      setNewCost('');
      setNotice({ kind: 'success', text: 'Product added.' });
      await load();
      onChanged();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    } finally {
      setAdding(false);
    }
  };

  const saveCost = async (productId: string) => {
    try {
      await api(`${API}/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ unitCost: editCost }),
      });
      setEditingId(null);
      setEditCost('');
      setNotice({ kind: 'success', text: 'Cost updated.' });
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const remove = async (productId: string, sku: string) => {
    if (!confirm(`Remove ${sku}?`)) return;
    try {
      await api(`${API}/products/${productId}`, { method: 'DELETE' });
      setNotice({ kind: 'success', text: `${sku} removed.` });
      await load();
      onChanged();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  return (
    <Modal title={`${vendor.name} · Catalog`} onClose={onClose}>
      <div className="space-y-4">
        {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

        {loading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
            No products yet. Add one below.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-right">Unit cost (KES)</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs">{p.sku}</td>
                    <td className="p-3 text-right">
                      {editingId === p.id ? (
                        <input
                          autoFocus
                          type="text"
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-right text-xs font-mono"
                          value={editCost}
                          onChange={(e) => setEditCost(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCost(p.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <span className="font-mono">{Number(p.unitCost).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Edit cost"
                          onClick={() => {
                            setEditingId(p.id);
                            setEditCost(p.unitCost);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          title="Remove product"
                          onClick={() => remove(p.id, p.sku)}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={add} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Add product
          </div>
          <div className="grid grid-cols-[1fr_140px_auto] items-end gap-3">
            <Field label="SKU">
              <input
                required
                className={`${inputCls} font-mono`}
                placeholder="e.g. BOLT-STEEL-M8"
                value={newSku}
                onChange={(e) => setNewSku(e.target.value)}
              />
            </Field>
            <Field label="Unit cost">
              <input
                type="text"
                inputMode="decimal"
                className={`${inputCls} font-mono`}
                placeholder="0.00"
                value={newCost}
                onChange={(e) => setNewCost(e.target.value)}
              />
            </Field>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}