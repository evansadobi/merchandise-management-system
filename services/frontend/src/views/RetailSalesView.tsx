import { useEffect, useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, inputCls, Pill } from '../components/ui';
import { api } from '../api';

interface Sale {
  saleId: string;
  storeId: string;
  registerId: string;
  customerId: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalAmount: string;
  paymentMethod: string;
  status?: string;
  createdAt?: string;
}

const API = 'http://localhost:3006/api/retail-sales/sales';

export default function RetailSalesView() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    saleId: 'SALE-1001',
    storeId: 'STORE-01',
    registerId: 'REG-01',
    customerId: 'CUST-01',
    sku: 'SKU-123',
    quantity: '2',
    unitPrice: '250.00',
    totalAmount: '500.00',
    paymentMethod: 'CARD',
  });

  const load = async () => {
    try {
      setError(null);
      const body = await api<{ data?: Sale[]; pagination?: unknown }>(`${API}?limit=50`);
      setSales(Array.isArray(body.data) ? body.data : []);
    } catch (e: any) {
      setError(`${e.message} (Is retail-sales-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api(API, {
        method: 'POST',
        body: JSON.stringify({
          saleId: form.saleId,
          storeId: form.storeId,
          registerId: form.registerId,
          customerId: form.customerId,
          sku: form.sku,
          quantity: Number(form.quantity),
          unitPrice: form.unitPrice,
          totalAmount: form.totalAmount,
          paymentMethod: form.paymentMethod,
        }),
      });
      setNotice({ kind: 'success', text: `Sale ${form.saleId} created.` });
      setForm((prev) => ({ ...prev, saleId: `SALE-${Math.floor(Math.random() * 9000) + 1000}` }));
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const columns: Column<Sale>[] = [
    { key: 'saleId', header: 'Sale ID', sortValue: (row) => row.saleId, render: (row) => <span className="font-mono text-xs">{row.saleId}</span> },
    { key: 'registerId', header: 'Register', sortValue: (row) => row.registerId, render: (row) => row.registerId },
    { key: 'sku', header: 'SKU', sortValue: (row) => row.sku, render: (row) => row.sku },
    { key: 'qty', header: 'Qty', align: 'center', sortValue: (row) => row.quantity, render: (row) => row.quantity },
    { key: 'total', header: 'Total', align: 'right', sortValue: (row) => Number(row.totalAmount), render: (row) => `KES ${Number(row.totalAmount).toLocaleString()}` },
    { key: 'method', header: 'Method', render: (row) => <Pill tone="blue">{row.paymentMethod}</Pill> },
    { key: 'status', header: 'Status', render: (row) => <Pill tone={row.status === 'VOIDED' ? 'red' : 'green'}>{row.status ?? 'COMPLETED'}</Pill> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Retail Sales</h2>
          <p className="text-sm text-slate-500">POS transactions and completed cashouts</p>
        </div>
      </div>

      {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <form onSubmit={handleCreate} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <Field label="Sale ID"><input className={inputCls} value={form.saleId} onChange={(e) => setForm({ ...form, saleId: e.target.value })} /></Field>
        <Field label="Store"><input className={inputCls} value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value })} /></Field>
        <Field label="Register"><input className={inputCls} value={form.registerId} onChange={(e) => setForm({ ...form, registerId: e.target.value })} /></Field>
        <Field label="Customer"><input className={inputCls} value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} /></Field>
        <Field label="SKU"><input className={inputCls} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        <Field label="Quantity"><input type="number" className={inputCls} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
        <Field label="Unit price"><input className={inputCls} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></Field>
        <Field label="Total amount"><input className={inputCls} value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} /></Field>
        <Field label="Payment method"><input className={inputCls} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} /></Field>
        <div className="flex items-end md:col-span-2 xl:col-span-1">
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            Create sale
          </button>
        </div>
      </form>

      <DataTable
        rows={sales}
        columns={columns}
        rowId={(row) => row.saleId}
        searchText={(row) => `${row.saleId} ${row.sku} ${row.registerId}`}
        searchPlaceholder="Search sale ID, SKU, or register"
        noun="sales"
        loading={loading}
        error={error}
      />
    </div>
  );
}
