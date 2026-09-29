import { useEffect, useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, Modal, Pill, QuickInput, WarnCircle, WarnTriangle, inputCls } from '../components/ui';
import { api, runAll, summarize } from '../api';

interface Item {
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

const API = 'http://localhost:3003/api/inventory';
const empty = { productName: '', sku: '', locationId: '', quantityOnHand: '', unitValue: '', reorderLevel: '' };

const stockState = (i: Item) => {
  const available = i.quantityOnHand - i.quantityAllocated;
  if (available <= 0) return 'OUT';
  if (i.quantityOnHand <= i.reorderLevel) return 'LOW';
  return 'OK';
};

export default function InventoryView() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState<string | null>(null);
  const [adjustIds, setAdjustIds] = useState<string[] | null>(null);
  const [reserving, setReserving] = useState<Item | null>(null);

  const load = async () => {
    try {
      setError(null);
      const body = await api<{ data: Item[] }>(`${API}?limit=100`);
      setItems(body.data);
    } catch (e: any) {
      setError(`${e.message} (Is inventory-service running?)`);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const byId = new Map(items.map((i) => [i.id, i]));

  const adjust = async (raw: string) => {
    const delta = Number(raw);
    if (!delta) { setNotice({ kind: 'error', text: 'Enter a non-zero number.' }); return; }
    const r = await runAll(adjustIds ?? [], (id) => {
      const it = byId.get(id)!;
      return api(`${API}/sku/${encodeURIComponent(it.sku)}/adjust`, { method: 'PATCH', body: JSON.stringify({ delta, locationId: it.locationId }) });
    });
    setNotice(summarize(r, 'adjusted'));
    await load();
  };

  const reserve = async (raw: string) => {
    if (!reserving) return;
    try {
      await api(`${API}/sku/${encodeURIComponent(reserving.sku)}/reserve`, {
        method: 'PATCH', body: JSON.stringify({ quantity: Number(raw), locationId: reserving.locationId }),
      });
      setNotice({ kind: 'success', text: `Reserved ${raw} × ${reserving.sku} at ${reserving.locationId}.` });
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
    await load();
  };

  const bulkDelete = async (ids: string[]) => {
    if (!confirm(`Delete ${ids.length} inventory record(s)?`)) return;
    const r = await runAll(ids, (id) => api(`${API}/${id}`, { method: 'DELETE' }));
    setNotice(summarize(r, 'deleted'));
    await load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api(API, {
        method: 'POST',
        body: JSON.stringify({
          productName: form.productName,
          sku: form.sku,
          locationId: form.locationId || undefined,
          quantityOnHand: form.quantityOnHand ? Number(form.quantityOnHand) : undefined,
          unitValue: form.unitValue || undefined,
          reorderLevel: form.reorderLevel ? Number(form.reorderLevel) : undefined,
        }),
      });
      setForm(empty);
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  const columns: Column<Item>[] = [
    { key: 'sku', header: 'SKU', sortValue: (i) => i.sku, render: (i) => <span className="font-mono text-xs">{i.sku}</span> },
    { key: 'name', header: 'Product name', sortValue: (i) => i.productName.toLowerCase(), render: (i) => <span className="font-medium text-slate-900">{i.productName}</span> },
    { key: 'loc', header: 'Location', sortValue: (i) => i.locationId, render: (i) => <span className="text-xs text-slate-500">{i.locationId}</span> },
    {
      key: 'onhand',
      header: 'On hand',
      align: 'center',
      sortValue: (i) => i.quantityOnHand,
      render: (i) => i.quantityOnHand,
    },
    {
      key: 'alloc',
      header: 'Allocated',
      align: 'center',
      sortValue: (i) => i.quantityAllocated,
      render: (i) => <span className="text-amber-600">{i.quantityAllocated}</span>,
    },
    {
      key: 'avail',
      header: 'Available',
      align: 'center',
      sortValue: (i) => i.quantityOnHand - i.quantityAllocated,
      render: (i) => {
        const available = i.quantityOnHand - i.quantityAllocated;
        const s = stockState(i);
        const cls =
          s === 'OUT' ? 'text-red-600' : s === 'LOW' ? 'text-amber-600' : 'text-green-600';
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className={`font-semibold ${cls}`}>{available}</span>
            {s === 'OUT' && <WarnTriangle />}
            {s === 'LOW' && <WarnCircle />}
          </span>
        );
      },
    },
    { key: 'order', header: 'On order', align: 'center', sortValue: (i) => i.quantityOnOrder, render: (i) => i.quantityOnOrder },
    { key: 'value', header: 'Unit value', align: 'right', sortValue: (i) => Number(i.unitValue), render: (i) => `KES ${Number(i.unitValue).toLocaleString()}` },
    {
      key: 'status',
      header: 'Status',
      render: (i) => {
        const s = stockState(i);
        return s === 'OUT' ? (
          <Pill tone="red">Out of stock</Pill>
        ) : s === 'LOW' ? (
          <Pill tone="yellow">Low stock</Pill>
        ) : (
          <Pill tone="green">In stock</Pill>
        );
      },
    },
  ];

  const locations = [...new Set(items.map((i) => i.locationId))];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory</h2>
          <p className="text-sm text-slate-500"></p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          + New record
        </button>
      </div>

      {notice && <Banner {...notice} onClose={() => setNotice(null)} />}

      <DataTable
        rows={items}
        columns={columns}
        rowId={(i) => i.id}
        noun="items"
        loading={loading}
        error={error}
        searchPlaceholder="Search product name or SKU"
        searchText={(i) => `${i.productName} ${i.sku} ${i.locationId}`}
        filters={[
          { label: 'All locations', options: locations.map((l) => ({ value: l, label: l })), predicate: (i, v) => i.locationId === v },
          { label: 'All stock levels', options: [{ value: 'OK', label: 'In stock' }, { value: 'LOW', label: 'Low stock' }, { value: 'OUT', label: 'Out of stock' }], predicate: (i, v) => stockState(i) === v },
        ]}
        bulkActions={[
          { label: 'Adjust stock', onClick: (ids) => setAdjustIds(ids) },
          { label: 'Delete', tone: 'danger', onClick: bulkDelete },
        ]}
        rowActions={(i) => {
          const available = i.quantityOnHand - i.quantityAllocated;
          return (
            <button
              onClick={() => setReserving(i)}
              disabled={available <= 0}
              title={available <= 0 ? 'No available stock to reserve' : undefined}
              className="text-xs font-semibold text-amber-700 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reserve
            </button>
          );
        }}
      />

      {adjustIds && (
        <QuickInput title={`Adjust stock for ${adjustIds.length} item(s)`} label="Change (+ to add, − to remove)" type="number"
          submitLabel="Apply adjustment" onSubmit={adjust} onClose={() => setAdjustIds(null)} />
      )}
      {reserving && (
        <QuickInput title={`Reserve ${reserving.sku}`} label={`Quantity (${reserving.quantityOnHand - reserving.quantityAllocated} available)`}
          type="number" submitLabel="Reserve" onSubmit={reserve} onClose={() => setReserving(null)} />
      )}

      {showCreate && (
        <Modal title="New inventory record" onClose={() => setShowCreate(false)}>
          <form onSubmit={create} className="grid grid-cols-2 gap-4">
            <Field label="Product name"><input required className={inputCls} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} /></Field>
            <Field label="SKU"><input required className={inputCls} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Location (optional)"><input placeholder="MAIN_WAREHOUSE" className={inputCls} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} /></Field>
            <Field label="Starting on hand"><input type="number" min={0} className={inputCls} value={form.quantityOnHand} onChange={(e) => setForm({ ...form, quantityOnHand: e.target.value })} /></Field>
            <Field label="Unit value"><input placeholder="1.25" className={inputCls} value={form.unitValue} onChange={(e) => setForm({ ...form, unitValue: e.target.value })} /></Field>
            <Field label="Reorder level"><input type="number" min={0} className={inputCls} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></Field>
            <div className="col-span-2 flex items-center justify-between">
              <span className="text-sm text-red-600">{formError}</span>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Create record</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}