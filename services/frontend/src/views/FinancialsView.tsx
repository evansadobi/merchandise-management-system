import { useEffect, useState } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, inputCls, Pill } from '../components/ui';
import { api } from '../api';

interface Ledger {
  id: string;
  ledgerId: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
  createdAt?: string;
  updatedAt?: string;
}

const API = 'http://localhost:3008/api/financials';

export default function FinancialsView() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    ledgerId: 'SALES_REVENUE',
    entryType: 'CREDIT',
    amount: '250.00',
    currency: 'KES',
    description: 'Retail sale booked',
  });

  const load = async () => {
    try {
      setError(null);
      const body = await api<Ledger[]>(`${API}/ledgers`);
      setLedgers(body);
    } catch (e: any) {
      setError(`${e.message} (Is financials-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api(`${API}/journal-entries`, {
        method: 'POST',
        body: JSON.stringify({
          ledgerId: form.ledgerId,
          entryType: form.entryType,
          amount: form.amount,
          currency: form.currency,
          description: form.description,
        }),
      });
      setNotice({ kind: 'success', text: `Journal entry posted to ${form.ledgerId}.` });
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const columns: Column<Ledger>[] = [
    { key: 'ledgerId', header: 'Ledger ID', sortValue: (row) => row.ledgerId, render: (row) => <span className="font-mono text-xs">{row.ledgerId}</span> },
    { key: 'name', header: 'Name', sortValue: (row) => row.name, render: (row) => row.name },
    { key: 'type', header: 'Type', render: (row) => <Pill tone="blue">{row.type}</Pill> },
    { key: 'currency', header: 'Currency', render: (row) => row.currency },
    { key: 'balance', header: 'Balance', align: 'right', sortValue: (row) => Number(row.balance), render: (row) => `KES ${Number(row.balance).toLocaleString()}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Financials</h2>
          <p className="text-sm text-slate-500">Ledger balances and journal entries</p>
        </div>
      </div>

      {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <form onSubmit={handleCreate} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <Field label="Ledger ID"><input className={inputCls} value={form.ledgerId} onChange={(e) => setForm({ ...form, ledgerId: e.target.value })} /></Field>
        <Field label="Entry type">
          <select className={inputCls} value={form.entryType} onChange={(e) => setForm({ ...form, entryType: e.target.value })}>
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
          </select>
        </Field>
        <Field label="Amount"><input className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Currency"><input className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></Field>
        <div className="flex items-end">
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
            Post entry
          </button>
        </div>
        <div className="md:col-span-2 xl:col-span-5">
          <Field label="Description"><input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
      </form>

      <DataTable
        rows={ledgers}
        columns={columns}
        rowId={(row) => row.id}
        searchText={(row) => `${row.ledgerId} ${row.name} ${row.type}`}
        searchPlaceholder="Search ledger or type"
        noun="ledgers"
        loading={loading}
        error={error}
      />
    </div>
  );
}
