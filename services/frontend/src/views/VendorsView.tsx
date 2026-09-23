import { useEffect, useState } from 'react';

interface Vendor {
  id: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  paymentTerms: string;
  leadTimeDays: number;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'ARCHIVED';
}

const API_BASE = 'http://localhost:3001';

export default function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    paymentTerms: '',
    leadTimeDays: '',
  });

  const loadVendors = () => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/vendors`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch vendors from backend');
        return res.json();
      })
      .then((body) => {
        setVendors(body.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/vendors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          paymentTerms: form.paymentTerms,
          leadTimeDays: Number(form.leadTimeDays),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      setForm({ name: '', contactEmail: '', contactPhone: '', paymentTerms: '', leadTimeDays: '' });
      setShowForm(false);
      loadVendors();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: Vendor['status']) => {
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      loadVendors();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this vendor? This cannot be undone.')) return;
    setActionError(null);
    try {
      const res = await fetch(`${API_BASE}/api/vendors/${id}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : JSON.stringify(body.error));
      }
      loadVendors();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Vendor Management Portal</h2>
          <p className="text-sm text-slate-500">Authoritative record of approved suppliers and terms.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          {showForm ? 'Cancel' : '+ Add New Vendor'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
            <input
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Email</label>
            <input
              required
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Contact Phone</label>
            <input
              required
              placeholder="+254712345678"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Payment Terms</label>
            <input
              required
              placeholder="Net 30"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.paymentTerms}
              onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Lead Time (days)</label>
            <input
              required
              type="number"
              min={0}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.leadTimeDays}
              onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex items-center justify-between">
            {formError && <p className="text-red-600 text-sm">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create Vendor'}
            </button>
          </div>
        </form>
      )}

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 mb-4 text-sm">{actionError}</div>
      )}

      {loading && <div className="text-slate-600">Loading vendor records...</div>}
      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">Error: {error} (Is your vendor-service running?)</div>}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Supplier Name</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4">Payment Terms</th>
                <th className="p-4">Lead Time</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm text-slate-700">
              {vendors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">No vendors found in the database.</td>
                </tr>
              ) : (
                vendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-slate-50">
                    <td className="p-4 font-medium text-slate-900">{vendor.name}</td>
                    <td className="p-4">
                      <div className="text-slate-900">{vendor.contactEmail}</div>
                      <div className="text-xs text-slate-400">{vendor.contactPhone}</div>
                    </td>
                    <td className="p-4">{vendor.paymentTerms}</td>
                    <td className="p-4">{vendor.leadTimeDays} days</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        vendor.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        vendor.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        vendor.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="p-4 space-x-2">
                      {vendor.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleStatusChange(vendor.id, 'APPROVED')}
                          className="text-xs font-semibold text-green-700 hover:underline"
                        >
                          Approve
                        </button>
                      )}
                      {vendor.status !== 'SUSPENDED' && (
                        <button
                          onClick={() => handleStatusChange(vendor.id, 'SUSPENDED')}
                          className="text-xs font-semibold text-amber-700 hover:underline"
                        >
                          Suspend
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(vendor.id)}
                        className="text-xs font-semibold text-red-700 hover:underline"
                      >
                        Delete
                      </button>
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