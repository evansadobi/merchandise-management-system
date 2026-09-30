import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowDownToLine, ClipboardCheck, ShieldCheck } from 'lucide-react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, Modal, Pill, inputCls } from '../components/ui';
import { api } from '../api';

interface ReceivingItem {
  id: string;
  grnId: string;
  expectedDeliveryId: string | null;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  conditionNotes: string | null;
  discrepancyType: 'NONE' | 'SHORTAGE' | 'OVERAGE';
  sellableQuantity: number;
}

interface GRN {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  receivedBy: string;
  status: 'COMPLETE' | 'DISCREPANCY';
  createdAt: string;
  items: ReceivingItem[];
}

interface ExpectedDelivery {
  id: string;
  purchaseOrderId: string;
  supplierId?: string | null;
  sku: string;
  quantityExpected: number;
  quantityReceivedSoFar: number;
  status: 'PENDING' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED';
}

interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  status: 'DRAFT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
}

interface Vendor {
  id: string;
  name: string;
  status: string;
}

const RECEIVING_API = `${import.meta.env.VITE_RECEIVING_API ?? 'http://localhost:3004'}/api`;
const PROCUREMENT_API = `${import.meta.env.VITE_PROCUREMENT_API ?? 'http://localhost:3002'}/api`;
const VENDOR_API = `${import.meta.env.VITE_VENDOR_API ?? 'http://localhost:3001'}/api/vendors`;

const DOCK_WORKERS = [
  'Dock Worker Alice',
  'Dock Worker Bob',
  'Dock Worker Carol',
  'Dock Worker Dan',
];

/** #F84B — short, uppercase, greppable. */
const tag = (id: string) => `#${id.slice(0, 4).toUpperCase()}`;
const shortPoRef = (id: string) => `PO-${id.slice(0, 8).toUpperCase()}`;
const shortenPurchaseOrderText = (text: string) =>
  text.replace(/Purchase order\s+([a-f0-9-]{36})/gi, (_, id: string) => shortPoRef(id));

/** Turn a GRN's items into one plain-English phrase. */
function itemsSummary(items: ReceivingItem[]): {
  text: string;
  tone: 'ok' | 'warn' | 'bad';
} {
  if (items.length === 0) return { text: 'No items', tone: 'bad' };

  const received = items.reduce((s, i) => s + i.receivedQuantity, 0);
  const damaged = items.reduce((s, i) => s + i.damagedQuantity, 0);
  const expected = items.reduce((s, i) => s + i.orderedQuantity, 0);
  const missing = Math.max(0, expected - received);
  const extra = Math.max(0, received - expected);

  const parts: string[] = [`${received} received`];
  let tone: 'ok' | 'warn' | 'bad' = 'ok';

  if (damaged > 0) {
    parts.push(`${damaged} damaged`);
    tone = 'bad';
  }
  if (missing > 0) {
    parts.push(`${missing} missing`);
    if (tone === 'ok') tone = 'warn';
  }
  if (extra > 0) {
    parts.push(`${extra} extra`);
    if (tone === 'ok') tone = 'warn';
  }

  return { text: parts.join(' · '), tone };
}


export default function ReceivingView() {
  const [grns, setGrns] = useState<GRN[]>([]);
  const [expectedDeliveries, setExpectedDeliveries] = useState<ExpectedDelivery[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGrn, setSelectedGrn] = useState<GRN | null>(null);
  const [livePurchaseOrder, setLivePurchaseOrder] = useState<PurchaseOrder | null>(null);

  const [form, setForm] = useState({
    expectedDeliveryId: '',
    receivedBy: DOCK_WORKERS[0]!,
    receivedQuantity: '',
    damagedQuantity: '',
    conditionNotes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadGrns = async () => {
    try {
      setError(null);
      const body = await api<{ data: GRN[] }>(`${RECEIVING_API}/grn?page=1&limit=100`);
      const rows = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
          ? (body as unknown as GRN[])
          : [];
      setGrns(rows.map((g) => ({ ...g, items: Array.isArray(g.items) ? g.items : [] })));
    } catch (e: any) {
      setError(`${e.message} (Is receiving-service running on port 3004?)`);
    } finally {
      setLoading(false);
    }
  };

  const loadExpectedDeliveries = async () => {
    try {
      const data = await api<ExpectedDelivery[]>(`${RECEIVING_API}/expected-deliveries`);
      setExpectedDeliveries(
        Array.isArray(data)
          ? data.filter((d) => d.status === 'PENDING' || d.status === 'PARTIALLY_RECEIVED')
          : [],
      );
    } catch {
      setExpectedDeliveries([]);
    }
  };

  const loadVendors = async () => {
    try {
      const body = await api<{ data: Vendor[] }>(`${VENDOR_API}?limit=100`);
      setVendors(Array.isArray(body?.data) ? body.data : []);
    } catch {
      setVendors([]);
    }
  };

  useEffect(() => {
    loadGrns();
    loadExpectedDeliveries();
    loadVendors();
  }, []);

  const vendorName = (id: string) =>
    vendors.find((v) => v.id === id)?.name ?? `${id.slice(0, 8)}…`;

  const metrics = [
    {
      label: 'Open deliveries',
      value: String(expectedDeliveries.length),
      tone: 'blue',
      icon: ArrowDownToLine,
    },
    {
      label: 'GRNs logged',
      value: String(grns.length),
      tone: 'slate',
      icon: ClipboardCheck,
    },
    {
      label: 'Discrepancies',
      value: String(grns.filter((entry) => entry.status === 'DISCREPANCY').length),
      tone: 'amber',
      icon: AlertTriangle,
    },
    {
      label: 'Sellable units',
      value: String(grns.reduce((total, entry) => total + entry.items.reduce((sum, item) => sum + item.sellableQuantity, 0), 0)),
      tone: 'green',
      icon: ShieldCheck,
    },
  ];

  const selectedDelivery = expectedDeliveries.find((d) => d.id === form.expectedDeliveryId);

  useEffect(() => {
    if (!selectedDelivery) {
      setLivePurchaseOrder(null);
      return;
    }

    let isCurrent = true;
    api<PurchaseOrder>(`${PROCUREMENT_API}/purchase-orders/${selectedDelivery.purchaseOrderId}`)
      .then((po) => {
        if (isCurrent) setLivePurchaseOrder(po);
      })
      .catch(() => {
        if (isCurrent) setLivePurchaseOrder(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedDelivery]);

  const remainingQuantity = selectedDelivery
    ? Math.max(
        0,
        (livePurchaseOrder
          ? livePurchaseOrder.quantityOrdered - livePurchaseOrder.quantityReceived
          : selectedDelivery.quantityExpected - selectedDelivery.quantityReceivedSoFar),
      )
    : null;

  const receivedSoFar = selectedDelivery
    ? (livePurchaseOrder?.quantityReceived ?? selectedDelivery.quantityReceivedSoFar)
    : 0;

  const resolveSupplierId = async (delivery: ExpectedDelivery): Promise<string> => {
    if (delivery.supplierId) return delivery.supplierId;

    const po = await api<PurchaseOrder>(
      `${PROCUREMENT_API}/purchase-orders/${delivery.purchaseOrderId}`,
    );
    if (!po?.vendorId) {
      throw new Error(
        `Could not determine supplier for PO ${delivery.purchaseOrderId}. Is procurement-service running?`,
      );
    }
    return po.vendorId;
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedDelivery) {
      setFormError('Select an expected delivery first.');
      return;
    }

    if (remainingQuantity === 0) {
      setFormError(`${shortPoRef(selectedDelivery.purchaseOrderId)} is already fully received — no further deliveries expected.`);
      return;
    }

    const received = Number(form.receivedQuantity);
    const damaged = form.damagedQuantity ? Number(form.damagedQuantity) : 0;

    if (remainingQuantity != null && received > remainingQuantity) {
      setFormError(
        `Cannot receive more than ${remainingQuantity} unit${
          remainingQuantity === 1 ? '' : 's'
        } — that's the remaining balance on this PO.`,
      );
      return;
    }

    if (damaged > received) {
      setFormError(
        `Damaged quantity (${damaged}) cannot exceed received quantity (${received}).`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const supplierId = await resolveSupplierId(selectedDelivery);

      const body = await api<GRN>(`${RECEIVING_API}/grn`, {
        method: 'POST',
        body: JSON.stringify({
          purchaseOrderId: selectedDelivery.purchaseOrderId,
          supplierId,
          receivedBy: form.receivedBy,
          items: [
            {
              sku: selectedDelivery.sku,
              receivedQuantity: received,
              damagedQuantity: damaged,
              conditionNotes: form.conditionNotes || undefined,
            },
          ],
        }),
      });

      setNotice({
        kind: 'success',
        text: `GRN ${body.id.slice(0, 8)} recorded — status ${body.status}. ${
          damaged > 0 ? `${damaged} damaged unit(s) quarantined.` : 'All units sellable.'
        }`,
      });
      setShowCreate(false);
      setForm({
        expectedDeliveryId: '',
        receivedBy: DOCK_WORKERS[0]!,
        receivedQuantity: '',
        damagedQuantity: '',
        conditionNotes: '',
      });
      await Promise.all([loadGrns(), loadExpectedDeliveries()]);
    } catch (err: any) {
      const raw: string = err?.message ?? 'Failed to record GRN';
      const cleaned = shortenPurchaseOrderText(
        raw
          .replace(/^(ConflictError|ValidationError|NotFoundError):\s*/i, '')
          .replace(/^\s+|\s+$/g, ''),
      );
      setFormError(cleaned || 'Failed to record GRN');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<GRN>[] = [
    {
      key: 'id',
      header: 'GRN',
      sortValue: (g) => g.id,
      render: (g) => (
        <span className="font-mono text-xs font-semibold text-slate-800">{tag(g.id)}</span>
      ),
    },
    {
      key: 'po',
      header: 'PO',
      sortValue: (g) => g.purchaseOrderId,
      render: (g) => (
        <span className="font-mono text-xs text-slate-500">{tag(g.purchaseOrderId)}</span>
      ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      sortValue: (g) => vendorName(g.supplierId).toLowerCase(),
      render: (g) => <span className="text-sm">{vendorName(g.supplierId)}</span>,
    },
    {
      key: 'receivedBy',
      header: 'By',
      sortValue: (g) => g.receivedBy,
      render: (g) => <span className="text-xs text-slate-500">{g.receivedBy}</span>,
    },
    {
      key: 'items',
      header: 'What arrived',
      render: (g) => {
        const { text, tone } = itemsSummary(g.items);
        const cls =
          tone === 'bad'
            ? 'text-red-700 hover:text-red-900'
            : tone === 'warn'
              ? 'text-amber-700 hover:text-amber-900'
              : 'text-slate-600 hover:text-slate-900';
        return (
          <button
            type="button"
            onClick={() => setSelectedGrn(g)}
            className={`text-left text-xs font-medium underline-offset-2 hover:underline ${cls}`}
            title="See details"
          >
            {text}
          </button>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortValue: (g) => g.createdAt,
      render: (g) => (
        <span className="text-xs text-slate-500">{new Date(g.createdAt).toLocaleString()}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (g) => g.status,
      render: (g) =>
        g.status === 'COMPLETE' ? (
          <Pill tone="green">OK</Pill>
        ) : (
          <Pill tone="yellow">Review</Pill>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Dock operations</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Receiving</h2>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={expectedDeliveries.length === 0}
            title={
              expectedDeliveries.length === 0
                ? 'No active expected deliveries to receive against'
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Record GRN
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const toneClass = {
            blue: 'bg-blue-100 text-blue-700',
            slate: 'bg-slate-100 text-slate-700',
            amber: 'bg-amber-100 text-amber-700',
            green: 'bg-emerald-100 text-emerald-700',
          }[metric.tone as 'blue' | 'slate' | 'amber' | 'green'];

          return (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
                </div>
                <div className={`rounded-xl p-2 ${toneClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {notice && (
        <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <DataTable
          rows={grns}
          columns={columns}
          rowId={(g) => g.id}
          noun="GRNs"
          loading={loading}
          error={error}
          searchPlaceholder="Search GRN, PO, or receiver"
          searchText={(g) =>
            `${g.id} ${g.purchaseOrderId} ${g.receivedBy} ${vendorName(g.supplierId)}`
          }
          filters={[
            {
              label: 'All statuses',
              options: [
                { value: 'COMPLETE', label: 'Complete' },
                { value: 'DISCREPANCY', label: 'Discrepancy' },
              ],
              predicate: (g, v) => g.status === v,
            },
          ]}
        />
      </div>

      {showCreate && (
        <Modal title="Record Goods Received Note" onClose={() => setShowCreate(false)}>
          <form onSubmit={submit} className="space-y-4">
            <Field label={`Expected delivery (${expectedDeliveries.length} active)`}>
              <select
                required
                className={inputCls}
                value={form.expectedDeliveryId}
                onChange={(e) => setForm({ ...form, expectedDeliveryId: e.target.value })}
              >
                <option value="">— Select an expected delivery —</option>
                {expectedDeliveries.map((d) => {
                  const remaining = d.quantityExpected - d.quantityReceivedSoFar;
                  return (
                    <option key={d.id} value={d.id}>
                      {d.sku} · {shortPoRef(d.purchaseOrderId)} · {remaining} remaining to receive
                    </option>
                  );
                })}
              </select>
            </Field>

            {selectedDelivery && (
              <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div>
                  <span className="font-semibold">SKU:</span>{' '}
                  <span className="font-mono">{selectedDelivery.sku}</span>
                </div>
                <div>
                  <span className="font-semibold">Purchase order:</span>{' '}
                  <span className="font-mono">{shortPoRef(selectedDelivery.purchaseOrderId)}</span>
                </div>
                <div>
                  <span className="font-semibold">Expected total:</span>{' '}
                  {selectedDelivery.quantityExpected} units ·{' '}
                  <span className="font-semibold">Received:</span>{' '}
                  {receivedSoFar} ·{' '}
                  <span className="font-semibold">Still to receive:</span> {remainingQuantity} units
                </div>
              </div>
            )}

            <Field label="Received by">
              <select
                required
                className={inputCls}
                value={form.receivedBy}
                onChange={(e) => setForm({ ...form, receivedBy: e.target.value })}
              >
                {DOCK_WORKERS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field
                label={`Qty to receive now${
                  remainingQuantity != null ? ` (remaining: ${remainingQuantity})` : ''
                }`}
              >
                <input
                  required
                  type="number"
                  min={0}
                  max={remainingQuantity ?? undefined}
                  className={inputCls}
                  value={form.receivedQuantity}
                  onChange={(e) => setForm({ ...form, receivedQuantity: e.target.value })}
                />
              </Field>
              <Field label="Damaged units">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.damagedQuantity}
                  onChange={(e) => setForm({ ...form, damagedQuantity: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Condition notes (optional)">
              <input
                className={inputCls}
                placeholder="e.g. 2 crushed on arrival"
                value={form.conditionNotes}
                onChange={(e) => setForm({ ...form, conditionNotes: e.target.value })}
              />
            </Field>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-red-600">{formError}</span>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Recording…' : 'Record GRN'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedGrn && (
        <GrnDetailModal
          grn={selectedGrn}
          supplierName={vendorName(selectedGrn.supplierId)}
          onClose={() => setSelectedGrn(null)}
        />
      )}
    </div>
  );
}


function GrnDetailModal({
  grn,
  supplierName,
  onClose,
}: {
  grn: GRN;
  supplierName: string;
  onClose: () => void;
}) {
  const tag = (id: string) => `#${id.slice(0, 4).toUpperCase()}`;

  const totals = grn.items.reduce(
    (acc, item) => ({
      expected: acc.expected + item.orderedQuantity,
      received: acc.received + item.receivedQuantity,
      damaged: acc.damaged + item.damagedQuantity,
      sellable: acc.sellable + item.sellableQuantity,
    }),
    { expected: 0, received: 0, damaged: 0, sellable: 0 },
  );

  const missing = Math.max(0, totals.expected - totals.received);
  const extra = Math.max(0, totals.received - totals.expected);

  const reasons: string[] = [];
  if (totals.damaged > 0) {
    reasons.push(
      `${totals.damaged} unit${totals.damaged === 1 ? '' : 's'} arrived damaged — excluded from sellable stock`,
    );
  }
  if (missing > 0) {
    reasons.push(
      `${missing} unit${missing === 1 ? '' : 's'} missing vs the PO expectation`,
    );
  }
  if (extra > 0) {
    reasons.push(
      `${extra} unit${extra === 1 ? '' : 's'} arrived beyond the PO expectation`,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              GRN {tag(grn.id)}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {grn.items.length === 1 ? grn.items[0]!.sku : `${grn.items.length} line items`}
              {' · '}
              {supplierName}
              {' · '}
              {grn.receivedBy}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Four big numbers */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Expected
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {totals.expected}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Received
            </div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {totals.received}
            </div>
          </div>
          <div
            className={`rounded-xl border p-3 ${
              totals.damaged > 0
                ? 'border-red-200 bg-red-50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Damaged
            </div>
            <div
              className={`mt-1 text-2xl font-bold ${
                totals.damaged > 0 ? 'text-red-600' : 'text-slate-400'
              }`}
            >
              {totals.damaged}
            </div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Sellable
            </div>
            <div className="mt-1 text-2xl font-bold text-green-700">
              {totals.sellable}
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="mb-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Why this status
          </h4>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            {reasons.length === 0 ? (
              <p className="text-sm text-green-700">
                Clean receipt — nothing missing, damaged, or extra.
              </p>
            ) : (
              <ul className="space-y-1.5 text-sm text-slate-700">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="mb-6">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Line items
          </h4>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="p-3">SKU</th>
                  <th className="p-3 text-center">Expected</th>
                  <th className="p-3 text-center">Received</th>
                  <th className="p-3 text-center">Damaged</th>
                  <th className="p-3 text-center">Sellable</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grn.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-3 font-mono text-xs">{item.sku}</td>
                    <td className="p-3 text-center">{item.orderedQuantity}</td>
                    <td className="p-3 text-center font-semibold">
                      {item.receivedQuantity}
                    </td>
                    <td
                      className={`p-3 text-center ${
                        item.damagedQuantity > 0
                          ? 'font-semibold text-red-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.damagedQuantity}
                    </td>
                    <td className="p-3 text-center font-semibold text-green-700">
                      {item.sellableQuantity}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {item.conditionNotes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div>
            <div className="font-semibold text-slate-600">Purchase order</div>
            <div className="font-mono">{grn.purchaseOrderId}</div>
          </div>
          <div>
            <div className="font-semibold text-slate-600">Recorded</div>
            <div>{new Date(grn.createdAt).toLocaleString()}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}