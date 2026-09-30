import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Banner, Field, Modal, Pill, inputCls } from '../components/ui';
import { api } from '../api';

type VendorStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'ARCHIVED';

interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: VendorStatus;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorProduct {
  id: string;
  vendorId: string;
  sku: string;
  unitCost: string;
  createdAt?: string;
  updatedAt?: string;
}

interface VendorListResponse {
  data: Vendor[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const API = `${import.meta.env.VITE_VENDOR_API ?? 'http://localhost:3001'}/api/vendors`;

const statusTone: Record<VendorStatus, 'green' | 'yellow' | 'red' | 'slate'> = {
  APPROVED: 'green',
  PENDING: 'yellow',
  SUSPENDED: 'red',
  ARCHIVED: 'slate',
};

const nextStatusMap: Record<VendorStatus, Array<{ label: string; value: VendorStatus }>> = {
  PENDING: [
    { label: 'Approve', value: 'APPROVED' },
    { label: 'Suspend', value: 'SUSPENDED' },
  ],
  APPROVED: [
    { label: 'Suspend', value: 'SUSPENDED' },
    { label: 'Archive', value: 'ARCHIVED' },
  ],
  SUSPENDED: [
    { label: 'Approve', value: 'APPROVED' },
    { label: 'Archive', value: 'ARCHIVED' },
  ],
  ARCHIVED: [],
};

const emptyVendorForm = {
  name: '',
  contactEmail: '',
  contactPhone: '',
  paymentTerms: '',
  leadTimeDays: '',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  return 'Vendor service unavailable';
}

function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<'ALL' | VendorStatus>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [menuVendorId, setMenuVendorId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyVendorForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadVendors = async (nextPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const body = await api<VendorListResponse>(`${API}?page=${nextPage}&limit=${limit}`);
      setVendors(Array.isArray(body?.data) ? body.data : []);
    } catch (caughtError) {
      setVendors([]);
      setError(`${getErrorMessage(caughtError)} (Vendor service unavailable)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVendors(page);
  }, []);

  useEffect(() => {
    if (!menuVendorId) return;
    const handleClick = () => setMenuVendorId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuVendorId]);

  const filteredVendors = useMemo(() => {
    const search = query.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const matchesStatus = statusFilter === 'ALL' || vendor.status === statusFilter;
      const haystack = `${vendor.name} ${vendor.contactEmail} ${vendor.contactPhone}`.toLowerCase();
      const matchesQuery = !search || haystack.includes(search);
      return matchesStatus && matchesQuery;
    });
  }, [vendors, query, statusFilter]);

  const handleCreateVendor = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    const trimmedName = createForm.name.trim();
    const trimmedEmail = createForm.contactEmail.trim();
    const trimmedPhone = createForm.contactPhone.trim();
    const trimmedTerms = createForm.paymentTerms.trim();
    const leadValue = Number(createForm.leadTimeDays);

    if (!trimmedName || !trimmedEmail || !trimmedPhone || !trimmedTerms) {
      setCreateError('Name, email, phone, and payment terms are required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setCreateError('Enter a valid email address.');
      return;
    }

    if (!/^\+?[0-9()\-\s.]{7,20}$/.test(trimmedPhone)) {
      setCreateError('Enter a valid phone number.');
      return;
    }

    if (!Number.isInteger(leadValue) || leadValue < 0) {
      setCreateError('Lead time days must be a non-negative integer.');
      return;
    }

    setSaving(true);
    try {
      await api<Vendor>(API, {
        method: 'POST',
        body: JSON.stringify({
          name: trimmedName,
          contactEmail: trimmedEmail,
          contactPhone: trimmedPhone,
          paymentTerms: trimmedTerms,
          leadTimeDays: leadValue,
        }),
      });

      setCreateForm(emptyVendorForm);
      setShowCreate(false);
      setNotice({ kind: 'success', text: 'Vendor created and set to PENDING' });
      setPage(1);
      await loadVendors(1);
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setCreateError(message);
      setNotice({ kind: 'error', text: message });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (vendor: Vendor, nextStatus: VendorStatus) => {
    setMenuVendorId(null);

    if ((nextStatus === 'ARCHIVED' || nextStatus === 'SUSPENDED') && !window.confirm(`Set ${vendor.name} to ${nextStatus}?`)) {
      return;
    }

    try {
      await api<Vendor>(`${API}/${vendor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice({
        kind: 'success',
        text: nextStatus === 'ARCHIVED' ? 'Vendor archived — products are no longer purchasable' : `Vendor updated to ${nextStatus}`,
      });
      await loadVendors(page);
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  const handleVendorDelete = async (vendor: Vendor) => {
    if (!window.confirm(`Delete ${vendor.name}? This action cannot be undone.`)) return;
    try {
      await api(`${API}/${vendor.id}`, { method: 'DELETE' });
      setNotice({ kind: 'success', text: 'Vendor deleted' });
      setSelectedVendor(null);
      await loadVendors(page);
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Supplier directory</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Vendors</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Vendor
        </button>
      </div>

      {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'APPROVED', 'PENDING', 'SUSPENDED', 'ARCHIVED'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setStatusFilter(option)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === option ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option === 'ALL' ? 'All' : option}
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search supplier, email or phone"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:bg-white md:max-w-xs"
          />
        </div>
      </div>

      <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact email</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Payment terms</th>
              <th className="px-4 py-3">Lead time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Loading suppliers…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center">
                  <div className="space-y-2">
                    <div className="text-red-600">{error}</div>
                    <button
                      type="button"
                      onClick={() => void loadVendors(page)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : filteredVendors.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  {vendors.length === 0 ? 'No vendors yet — add your first supplier.' : 'No vendors match your filters.'}
                </td>
              </tr>
            ) : (
              filteredVendors.map((vendor) => (
                <tr
                  key={vendor.id}
                  className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                  onClick={() => setSelectedVendor(vendor)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{vendor.name}</div>
                    <div className="text-xs text-slate-500">{vendor.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{vendor.contactEmail}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.contactPhone}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.paymentTerms}</td>
                  <td className="px-4 py-3 text-slate-600">{vendor.leadTimeDays} days</td>
                  <td className="px-4 py-3">
                    <Pill tone={statusTone[vendor.status]}>{vendor.status}</Pill>
                  </td>
                  <td className="relative z-10 px-4 py-3 text-right">
                    <div className="relative inline-block z-20" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-700"
                        onClick={() => setMenuVendorId((current) => (current === vendor.id ? null : vendor.id))}
                        aria-label={`Vendor actions for ${vendor.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>

                      {menuVendorId === vendor.id && (
                        <div className="absolute right-0 top-full z-20 mt-2 w-42 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                          <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setSelectedVendor(vendor)}>
                            View
                          </button>
                          <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setSelectedVendor(vendor)}>
                            Edit
                          </button>
                          {nextStatusMap[vendor.status].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                              onClick={() => void handleStatusChange(vendor, option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                          <button type="button" className="block w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => void handleVendorDelete(vendor)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && vendors.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="text-sm text-slate-500">
            Page {page} of {Math.max(1, Math.ceil(vendors.length / limit))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => {
                const next = Math.max(1, page - 1);
                setPage(next);
                void loadVendors(next);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                const next = page + 1;
                setPage(next);
                void loadVendors(next);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal title="New vendor" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateVendor} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name">
                <input
                  required
                  className={inputCls}
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                />
              </Field>

              <Field label="Contact email">
                <input
                  required
                  type="email"
                  className={inputCls}
                  value={createForm.contactEmail}
                  onChange={(event) => setCreateForm((current) => ({ ...current, contactEmail: event.target.value }))}
                />
              </Field>

              <Field label="Contact phone">
                <input
                  required
                  className={inputCls}
                  placeholder="+254712345678"
                  value={createForm.contactPhone}
                  onChange={(event) => setCreateForm((current) => ({ ...current, contactPhone: event.target.value }))}
                />
              </Field>

              <Field label="Lead time (days)">
                <input
                  required
                  min={0}
                  type="number"
                  className={inputCls}
                  value={createForm.leadTimeDays}
                  onChange={(event) => setCreateForm((current) => ({ ...current, leadTimeDays: event.target.value }))}
                />
              </Field>
            </div>

            <Field label="Payment terms">
              <input
                required
                className={inputCls}
                value={createForm.paymentTerms}
                onChange={(event) => setCreateForm((current) => ({ ...current, paymentTerms: event.target.value }))}
              />
            </Field>

            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Creating…' : 'Create vendor'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedVendor && (
        <VendorDrawer
          vendor={selectedVendor}
          onClose={() => setSelectedVendor(null)}
          onSaved={async () => {
            setSelectedVendor(null);
            await loadVendors(page);
          }}
          onDeleted={async () => {
            setSelectedVendor(null);
            await loadVendors(page);
          }}
        />
      )}
    </div>
  );
}

function VendorDrawer({
  vendor,
  onClose,
  onSaved,
  onDeleted,
}: {
  vendor: Vendor;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    name: vendor.name,
    contactEmail: vendor.contactEmail,
    contactPhone: vendor.contactPhone,
    paymentTerms: vendor.paymentTerms,
    leadTimeDays: String(vendor.leadTimeDays),
  });
  const [editingContact, setEditingContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedVendorId, setCopiedVendorId] = useState<string | null>(null);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ sku: '', unitCost: '' });
  const [addingProduct, setAddingProduct] = useState(false);
  const [productEditId, setProductEditId] = useState<string | null>(null);
  const [productEditCost, setProductEditCost] = useState('');

  useEffect(() => {
    setForm({
      name: vendor.name,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      paymentTerms: vendor.paymentTerms,
      leadTimeDays: String(vendor.leadTimeDays),
    });
  }, [vendor]);

  const handleCopyId = async (vendorId: string) => {
    try {
      await navigator.clipboard.writeText(vendorId);
      setCopiedVendorId(vendorId);
      window.setTimeout(() => setCopiedVendorId((current) => (current === vendorId ? null : current)), 1200);
    } catch {
      setCopiedVendorId(null);
    }
  };

  const loadProducts = async () => {
    try {
      setProductLoading(true);
      setProductError(null);
      const rows = await api<VendorProduct[]>(`${API}/${vendor.id}/products`);
      setProducts(Array.isArray(rows) ? rows : []);
    } catch (caughtError) {
      setProductError(getErrorMessage(caughtError));
      setProducts([]);
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [vendor.id]);

  const handleSaveVendor = async () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim());
    const phoneOk = /^\+?[0-9()\-\s.]{7,20}$/.test(form.contactPhone.trim());
    const leadValue = Number(form.leadTimeDays);

    if (!form.name.trim() || !form.contactEmail.trim() || !form.contactPhone.trim() || !form.paymentTerms.trim()) {
      setNotice({ kind: 'error', text: 'Name, email, phone, and payment terms are required.' });
      return;
    }
    if (!emailOk) {
      setNotice({ kind: 'error', text: 'Enter a valid email address.' });
      return;
    }
    if (!phoneOk) {
      setNotice({ kind: 'error', text: 'Enter a valid phone number.' });
      return;
    }
    if (!Number.isInteger(leadValue) || leadValue < 0) {
      setNotice({ kind: 'error', text: 'Lead time must be a non-negative integer.' });
      return;
    }

    setSaving(true);
    try {
      await api<Vendor>(`${API}/${vendor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim(),
          paymentTerms: form.paymentTerms.trim(),
          leadTimeDays: leadValue,
        }),
      });
      setNotice({ kind: 'success', text: 'Vendor updated' });
      setEditingContact(false);
      await onSaved();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (nextStatus: VendorStatus) => {
    if ((nextStatus === 'ARCHIVED' || nextStatus === 'SUSPENDED') && !window.confirm(`Set ${vendor.name} to ${nextStatus}?`)) {
      return;
    }

    try {
      await api<Vendor>(`${API}/${vendor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice({
        kind: 'success',
        text: nextStatus === 'ARCHIVED' ? 'Vendor archived — products are no longer purchasable' : `Vendor updated to ${nextStatus}`,
      });
      await onSaved();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  const handleDeleteVendor = async () => {
    if (!window.confirm(`Delete ${vendor.name}? This action cannot be undone.`)) return;
    try {
      await api(`${API}/${vendor.id}`, { method: 'DELETE' });
      setNotice({ kind: 'success', text: 'Vendor deleted' });
      await onDeleted();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  const handleAddProduct = async (event: FormEvent) => {
    event.preventDefault();
    const sku = newProduct.sku.trim();
    const unitCost = newProduct.unitCost.trim();

    if (!sku) {
      setNotice({ kind: 'error', text: 'SKU is required.' });
      return;
    }

    if (Number.isNaN(Number(unitCost)) || Number(unitCost) < 0) {
      setNotice({ kind: 'error', text: 'Unit cost must be a valid non-negative number.' });
      return;
    }

    setAddingProduct(true);
    try {
      await api<VendorProduct>(`${API}/${vendor.id}/products`, {
        method: 'POST',
        body: JSON.stringify({ sku, unitCost }),
      });
      setNewProduct({ sku: '', unitCost: '' });
      setShowAddProduct(false);
      setNotice({ kind: 'success', text: 'Product added' });
      await loadProducts();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    } finally {
      setAddingProduct(false);
    }
  };

  const handleDeleteProduct = async (product: VendorProduct) => {
    if (!window.confirm(`Remove ${product.sku}?`)) return;
    try {
      await api(`${API}/products/${product.id}`, { method: 'DELETE' });
      setNotice({ kind: 'success', text: `${product.sku} removed` });
      await loadProducts();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  const handleEditProductCost = async (productId: string) => {
    const value = Number(productEditCost);
    if (Number.isNaN(value) || value < 0) {
      setNotice({ kind: 'error', text: 'Valid unit cost is required.' });
      return;
    }

    try {
      await api<VendorProduct>(`${API}/products/${productId}`, {
        method: 'PATCH',
        body: JSON.stringify({ unitCost: productEditCost.trim() }),
      });
      setProductEditId(null);
      setProductEditCost('');
      setNotice({ kind: 'success', text: 'Product updated' });
      await loadProducts();
    } catch (caughtError) {
      setNotice({ kind: 'error', text: getErrorMessage(caughtError) });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40" onClick={onClose}>
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Supplier profile</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{vendor.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Contact</h3>
              <button type="button" onClick={() => setEditingContact((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <Pencil className="h-3.5 w-3.5" />
                {editingContact ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {!editingContact ? (
              <div className="space-y-3 text-sm text-slate-600">
                <div><span className="font-medium text-slate-900">Name:</span> {vendor.name}</div>
                <div><span className="font-medium text-slate-900">Email:</span> {vendor.contactEmail}</div>
                <div><span className="font-medium text-slate-900">Phone:</span> {vendor.contactPhone}</div>
                <div><span className="font-medium text-slate-900">Payment terms:</span> {vendor.paymentTerms}</div>
                <div><span className="font-medium text-slate-900">Lead time:</span> {vendor.leadTimeDays} days</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Name">
                    <input className={inputCls} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={inputCls} value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} />
                  </Field>
                  <Field label="Phone">
                    <input className={inputCls} value={form.contactPhone} onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))} />
                  </Field>
                  <Field label="Lead time days">
                    <input type="number" min={0} className={inputCls} value={form.leadTimeDays} onChange={(event) => setForm((current) => ({ ...current, leadTimeDays: event.target.value }))} />
                  </Field>
                </div>

                <Field label="Payment terms">
                  <input className={inputCls} value={form.paymentTerms} onChange={(event) => setForm((current) => ({ ...current, paymentTerms: event.target.value }))} />
                </Field>

                <div className="flex justify-end">
                  <button type="button" onClick={() => void handleSaveVendor()} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Status</h3>
              <Pill tone={statusTone[vendor.status]}>{vendor.status}</Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextStatusMap[vendor.status].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => void handleStatusChange(option.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {option.label}
                </button>
              ))}
              {nextStatusMap[vendor.status].length === 0 && (
                <span className="text-sm text-slate-500">No further status changes available.</span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Products catalog</h3>
              <button type="button" onClick={() => setShowAddProduct(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" /> Add Product
              </button>
            </div>

            {productLoading ? (
              <div className="text-sm text-slate-500">Loading products…</div>
            ) : productError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{productError}</div>
            ) : products.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No products yet — add the first SKU this supplier is approved to provide.
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2 text-right">Unit cost (KES)</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-t border-slate-200 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono text-xs">{product.sku}</td>
                        <td className="px-3 py-2 text-right">
                          {productEditId === product.id ? (
                            <input
                              autoFocus
                              className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs font-mono"
                              value={productEditCost}
                              onChange={(event) => setProductEditCost(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') void handleEditProductCost(product.id);
                                if (event.key === 'Escape') {
                                  setProductEditId(null);
                                  setProductEditCost('');
                                }
                              }}
                            />
                          ) : (
                            <span className="font-mono">{Number(product.unitCost).toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => {
                              setProductEditId(product.id);
                              setProductEditCost(product.unitCost);
                            }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => void handleDeleteProduct(product)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
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
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Metadata</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">Vendor ID</span>
                <button type="button" onClick={() => void handleCopyId(vendor.id)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs text-indigo-600 hover:bg-slate-50">
                  {vendor.id}
                  {copiedVendorId === vendor.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">Created</span>
                <span>{formatDate(vendor.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-900">Updated</span>
                <span>{formatDate(vendor.updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={() => void handleDeleteVendor()} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100">
            Delete vendor
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>

      {showAddProduct && (
        <Modal title={`Add product for ${vendor.name}`} onClose={() => setShowAddProduct(false)}>
          <form onSubmit={handleAddProduct} className="space-y-4">
            <Field label="SKU">
              <input required className={inputCls} placeholder="SKU-001" value={newProduct.sku} onChange={(event) => setNewProduct((current) => ({ ...current, sku: event.target.value }))} />
            </Field>
            <Field label="Unit cost (KES)">
              <input required type="number" min={0} step="0.01" className={inputCls} value={newProduct.unitCost} onChange={(event) => setNewProduct((current) => ({ ...current, unitCost: event.target.value }))} />
            </Field>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowAddProduct(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={addingProduct} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {addingProduct ? 'Adding…' : 'Add product'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
