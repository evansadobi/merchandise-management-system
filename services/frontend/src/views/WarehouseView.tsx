import { useEffect, useState, type FormEvent } from 'react';
import DataTable, { type Column } from '../components/DataTable';
import { Banner, Field, Modal, Pill, inputCls } from '../components/ui';
import { api } from '../api';

interface Bin {
  id: string;
  fullCode: string;
  capacityUnits: number;
  currentUtilization: number;
  zoneCode: 'FAST' | 'MID' | 'BULK';
}

interface PutawayTask {
  id: string;
  grnId: string;
  purchaseOrderId: string;
  sku: string;
  quantity: number;
  suggestedBinId: string | null;
  actualBinId: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedTo: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt: string | null;
}

interface PickingTask {
  id: string;
  referenceId: string;
  sku: string;
  quantity: number;
  fromBinId: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedTo: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt: string | null;
}

interface UtilizationReport {
  warehouseId: string;
  totalBins: number;
  totalCapacity: number;
  totalUtilization: number;
  utilizationPct: number;
  byZone: { zoneCode: string; bins: number; capacity: number; utilization: number }[];
}

interface SuggestResult {
  bin: Bin | null;
  zone: 'FAST' | 'MID' | 'BULK';
  reason: string;
}

interface SkuOption {
  sku: string;
  productName: string;
  velocity: string | null;
}

const WAREHOUSE_API = 'http://localhost:3005/api';
const INVENTORY_API = 'http://localhost:3003/api';
const WH = 'MAIN_WAREHOUSE';

const DOCK_WORKERS = ['Alice Mwangi', 'Bob Otieno', 'Carol Wanjiku', 'Dan Kariuki'];

const taskTone = {
  PENDING: 'slate',
  IN_PROGRESS: 'yellow',
  COMPLETED: 'green',
  CANCELLED: 'red',
} as const;

export default function WarehouseView() {
  const [tab, setTab] = useState<'putaway' | 'picking' | 'slotting'>('putaway');
  const [report, setReport] = useState<UtilizationReport | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);

  const loadSummary = async () => {
    try {
      const [rpt, avail] = await Promise.all([
        api<UtilizationReport>(`${WAREHOUSE_API}/bins/utilization?warehouseId=${WH}`),
        api<Bin[]>(`${WAREHOUSE_API}/bins/available?warehouseId=${WH}&minCapacity=1`),
      ]);
      setReport(rpt);
      setBins(avail);
    } catch {
      setReport(null);
      setBins([]);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Warehouse</h2>
          <p className="text-sm text-slate-500">
          
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-4">
        <SummaryCard
          label="Total bins"
          value={report?.totalBins ?? '—'}
          subtext={
            report
              ? `across ${report.byZone.length} zone${report.byZone.length === 1 ? '' : 's'}`
              : undefined
          }
        />
        <SummaryCard
          label="Total capacity"
          value={report?.totalCapacity.toLocaleString() ?? '—'}
          subtext="units"
        />
        <SummaryCard
          label="In use"
          value={report?.totalUtilization ?? '—'}
          subtext={
            report && report.totalCapacity > 0
              ? `${report.totalCapacity - report.totalUtilization} free`
              : undefined
          }
        />
        <SummaryCard
          label="Utilization"
          value={report ? `${report.utilizationPct}%` : '—'}
          subtext={
            report && report.utilizationPct > 80
              ? 'Near capacity'
              : report && report.utilizationPct > 50
                ? 'Moderate'
                : 'Plenty of room'
          }
          tone={report && report.utilizationPct > 80 ? 'red' : 'green'}
        />
      </div>

      <div className="mb-6 flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
        {(['putaway', 'picking', 'slotting'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition ${
              tab === t
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'putaway' && <PutawayTab bins={bins} onChanged={loadSummary} />}
      {tab === 'picking' && <PickingTab bins={bins} />}
      {tab === 'slotting' && <SlottingTab />}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  tone?: 'red' | 'green';
}) {
  const accentCls =
    tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-green-700' : 'text-slate-900';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-3xl font-bold tracking-tight ${accentCls}`}>{value}</div>
      {subtext && <div className="mt-2 text-xs text-slate-500">{subtext}</div>}
    </div>
  );
}

function SmallStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger';
}) {
  const valueCls =
    tone === 'accent'
      ? 'text-indigo-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'danger'
          ? 'text-red-600'
          : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className={`mt-0.5 text-xl font-bold ${valueCls}`}>{value}</div>
    </div>
  );
}

function PutawayTab({ bins, onChanged }: { bins: Bin[]; onChanged: () => void }) {
  const [tasks, setTasks] = useState<PutawayTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [startingTask, setStartingTask] = useState<PutawayTask | null>(null);
  const [completingTask, setCompletingTask] = useState<PutawayTask | null>(null);

  const load = async () => {
    try {
      setError(null);
      setTasks(await api<PutawayTask[]>(`${WAREHOUSE_API}/putaway/tasks`));
    } catch (e: any) {
      setError(`${e.message} (Is warehouse-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStart = async (taskId: string, assignedTo: string) => {
    try {
      await api(`${WAREHOUSE_API}/putaway/tasks/${taskId}/start`, {
        method: 'POST',
        body: JSON.stringify({ assignedTo }),
      });
      setStartingTask(null);
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const handleComplete = async (taskId: string, actualBinId: string, actualQuantity: number) => {
    try {
      await api(`${WAREHOUSE_API}/putaway/tasks/${taskId}/complete`, {
        method: 'POST',
        body: JSON.stringify({ actualBinId, actualQuantity }),
      });
      setNotice({
        kind: 'success',
        text: `Task completed. Placed ${actualQuantity} unit${actualQuantity === 1 ? '' : 's'}.`,
      });
      setCompletingTask(null);
      await load();
      onChanged();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const active = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const completed = tasks.filter((t) => t.status === 'COMPLETED').slice(0, 10);
  const cancelled = tasks.filter((t) => t.status === 'CANCELLED').length;

  const columns: Column<PutawayTask>[] = [
    { key: 'sku', header: 'SKU', sortValue: (t) => t.sku, render: (t) => <span className="font-mono text-xs">{t.sku}</span> },
    { key: 'qty', header: 'Qty', align: 'right', sortValue: (t) => t.quantity, render: (t) => t.quantity },
    { key: 'grn', header: 'GRN', render: (t) => <span className="font-mono text-xs text-slate-500">{t.grnId.slice(0, 8)}…</span> },
    {
      key: 'suggested',
      header: 'Suggested bin',
      render: (t) => {
        if (!t.suggestedBinId) return <span className="text-xs text-slate-400">none</span>;
        const bin = bins.find((b) => b.id === t.suggestedBinId);
        return <span className="font-mono text-xs">{bin?.fullCode ?? t.suggestedBinId.slice(0, 8)}</span>;
      },
    },
    {
      key: 'assigned',
      header: 'Assigned to',
      render: (t) =>
        t.assignedTo ? (
          <span className="text-xs text-slate-700">{t.assignedTo}</span>
        ) : (
          <span className="text-xs text-slate-400">unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => t.status,
      render: (t) => <Pill tone={taskTone[t.status]}>{t.status.replace('_', ' ')}</Pill>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <>
          {t.status === 'PENDING' && (
            <button onClick={() => setStartingTask(t)} className="text-xs font-semibold text-amber-700 hover:underline">
              Start
            </button>
          )}
          {t.status === 'IN_PROGRESS' && (
            <button onClick={() => setCompletingTask(t)} className="text-xs font-semibold text-green-700 hover:underline">
              Complete
            </button>
          )}
        </>
      ),
    },
  ];

  const completedColumns: Column<PutawayTask>[] = [
    ...columns.slice(0, 6),
    {
      key: 'completedAt',
      header: 'Completed',
      render: (t) => (
        <span className="text-xs text-slate-500">
          {t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <SmallStat label="Active" value={active.length} tone={active.length > 0 ? 'accent' : 'neutral'} />
        <SmallStat label="Completed today" value={completed.length} />
        <SmallStat label="Cancelled" value={cancelled} tone={cancelled > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Active queue ({active.length})
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : active.length === 0 ? null : (
        <DataTable
          rows={active}
          columns={columns}
          rowId={(t) => t.id}
          noun="active putaway tasks"
          loading={false}
          error={null}
          searchPlaceholder="Search SKU or GRN"
          searchText={(t) => `${t.sku} ${t.grnId}`}
          filters={[
            {
              label: 'All statuses',
              options: ['PENDING', 'IN_PROGRESS'].map((s) => ({ value: s, label: s.replace('_', ' ') })),
              predicate: (t, v) => t.status === v,
            },
          ]}
          pageSize={20}
        />
      )}

      {completed.length > 0 && (
        <>
          <div className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recently completed ({completed.length})
          </div>
          <DataTable
            rows={completed}
            columns={completedColumns}
            rowId={(t) => t.id}
            noun="completed putaway tasks"
            loading={false}
            error={null}
            searchPlaceholder="Search SKU or GRN"
            searchText={(t) => `${t.sku} ${t.grnId}`}
            pageSize={5}
          />
        </>
      )}

      {startingTask && (
        <StartTaskModal
          sku={startingTask.sku}
          quantity={startingTask.quantity}
          onConfirm={(worker) => handleStart(startingTask.id, worker)}
          onClose={() => setStartingTask(null)}
        />
      )}

      {completingTask && (
        <CompletePutawayModal
          task={completingTask}
          bins={bins}
          onConfirm={(binId, qty) => handleComplete(completingTask.id, binId, qty)}
          onClose={() => setCompletingTask(null)}
        />
      )}
    </>
  );
}

function PickingTab({ bins }: { bins: Bin[] }) {
  const [tasks, setTasks] = useState<PickingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [startingTask, setStartingTask] = useState<PickingTask | null>(null);

  const load = async () => {
    try {
      setError(null);
      setTasks(await api<PickingTask[]>(`${WAREHOUSE_API}/picking/tasks`));
    } catch (e: any) {
      setError(`${e.message} (Is warehouse-service running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleStart = async (taskId: string, assignedTo: string) => {
    try {
      await api(`${WAREHOUSE_API}/picking/tasks/${taskId}/start`, {
        method: 'POST',
        body: JSON.stringify({ assignedTo }),
      });
      setStartingTask(null);
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await api(`${WAREHOUSE_API}/picking/tasks/${taskId}/complete`, { method: 'POST' });
      setNotice({ kind: 'success', text: 'Pick task completed.' });
      await load();
    } catch (e: any) {
      setNotice({ kind: 'error', text: e.message });
    }
  };

  const active = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS');
  const completed = tasks.filter((t) => t.status === 'COMPLETED').slice(0, 10);
  const cancelled = tasks.filter((t) => t.status === 'CANCELLED').length;

  const binCode = (binId: string | null): string => {
    if (!binId) return '—';
    const bin = bins.find((b) => b.id === binId);
    return bin?.fullCode ?? binId.slice(0, 8);
  };

  const columns: Column<PickingTask>[] = [
    { key: 'sku', header: 'SKU', sortValue: (t) => t.sku, render: (t) => <span className="font-mono text-xs">{t.sku}</span> },
    { key: 'qty', header: 'Qty', align: 'right', sortValue: (t) => t.quantity, render: (t) => t.quantity },
    {
      key: 'fromBin',
      header: 'From bin',
      render: (t) =>
        t.fromBinId ? (
          <span className="font-mono text-xs font-semibold text-slate-700">{binCode(t.fromBinId)}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'ref',
      header: 'Transfer',
      render: (t) => <span className="font-mono text-xs text-slate-500">{t.referenceId.slice(0, 8)}…</span>,
    },
    {
      key: 'assigned',
      header: 'Assigned to',
      render: (t) =>
        t.assignedTo ? (
          <span className="text-xs text-slate-700">{t.assignedTo}</span>
        ) : (
          <span className="text-xs text-slate-400">unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (t) => t.status,
      render: (t) => <Pill tone={taskTone[t.status]}>{t.status.replace('_', ' ')}</Pill>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <>
          {t.status === 'PENDING' && (
            <button onClick={() => setStartingTask(t)} className="text-xs font-semibold text-amber-700 hover:underline">
              Start
            </button>
          )}
          {t.status === 'IN_PROGRESS' && (
            <button onClick={() => handleComplete(t.id)} className="text-xs font-semibold text-green-700 hover:underline">
              Complete
            </button>
          )}
        </>
      ),
    },
  ];

  const completedColumns: Column<PickingTask>[] = [
    ...columns.slice(0, 6),
    {
      key: 'completedAt',
      header: 'Completed',
      render: (t) => (
        <span className="text-xs text-slate-500">
          {t.completedAt ? new Date(t.completedAt).toLocaleTimeString() : '—'}
        </span>
      ),
    },
  ];

  return (
    <>
      {notice && <Banner kind={notice.kind} text={notice.text} onClose={() => setNotice(null)} />}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <SmallStat label="Active" value={active.length} tone={active.length > 0 ? 'accent' : 'neutral'} />
        <SmallStat label="Completed today" value={completed.length} />
        <SmallStat label="Cancelled" value={cancelled} tone={cancelled > 0 ? 'warn' : 'neutral'} />
      </div>

      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Active queue ({active.length})
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : active.length === 0 ? null : (
        <DataTable
          rows={active}
          columns={columns}
          rowId={(t) => t.id}
          noun="active picking tasks"
          loading={false}
          error={null}
          searchPlaceholder="Search SKU or transfer"
          searchText={(t) => `${t.sku} ${t.referenceId}`}
          filters={[
            {
              label: 'All statuses',
              options: ['PENDING', 'IN_PROGRESS'].map((s) => ({ value: s, label: s.replace('_', ' ') })),
              predicate: (t, v) => t.status === v,
            },
          ]}
          pageSize={20}
        />
      )}

      {completed.length > 0 && (
        <>
          <div className="mt-8 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recently completed ({completed.length})
          </div>
          <DataTable
            rows={completed}
            columns={completedColumns}
            rowId={(t) => t.id}
            noun="completed picking tasks"
            loading={false}
            error={null}
            searchPlaceholder="Search SKU or transfer"
            searchText={(t) => `${t.sku} ${t.referenceId}`}
            pageSize={5}
          />
        </>
      )}

      {startingTask && (
        <StartTaskModal
          sku={startingTask.sku}
          quantity={startingTask.quantity}
          fromBin={binCode(startingTask.fromBinId)}
          onConfirm={(worker) => handleStart(startingTask.id, worker)}
          onClose={() => setStartingTask(null)}
        />
      )}
    </>
  );
}

function StartTaskModal({
  sku,
  quantity,
  fromBin,
  onConfirm,
  onClose,
}: {
  sku: string;
  quantity: number;
  fromBin?: string;
  onConfirm: (worker: string) => void;
  onClose: () => void;
}) {
  const [worker, setWorker] = useState(DOCK_WORKERS[0]!);

  return (
    <Modal title="Who is doing this task?" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(worker);
        }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div>
            <span className="font-semibold">SKU:</span> <span className="font-mono">{sku}</span>
          </div>
          <div>
            <span className="font-semibold">Quantity:</span> {quantity}
          </div>
          {fromBin && (
            <div>
              <span className="font-semibold">From bin:</span> <span className="font-mono">{fromBin}</span>
            </div>
          )}
        </div>

        <Field label="Worker">
          <select required className={inputCls} value={worker} onChange={(e) => setWorker(e.target.value)}>
            {DOCK_WORKERS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start task
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CompletePutawayModal({
  task,
  bins,
  onConfirm,
  onClose,
}: {
  task: PutawayTask;
  bins: Bin[];
  onConfirm: (binId: string, quantity: number) => void;
  onClose: () => void;
}) {
  const suggestedBin = task.suggestedBinId ? bins.find((b) => b.id === task.suggestedBinId) : null;

  const [binId, setBinId] = useState<string>(suggestedBin?.id ?? '');
  const [quantity, setQuantity] = useState<string>(String(task.quantity));
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q ? bins.filter((b) => b.fullCode.toLowerCase().includes(q)) : bins;

  const chosenBin = bins.find((b) => b.id === binId);
  const qtyNum = Number(quantity);
  const qtyValid = qtyNum > 0 && qtyNum <= task.quantity;
  const binHasRoom = chosenBin != null && chosenBin.capacityUnits - chosenBin.currentUtilization >= qtyNum;
  const canSubmit = chosenBin != null && qtyValid && binHasRoom;

  return (
    <Modal title="Complete putaway" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          onConfirm(binId, qtyNum);
        }}
        className="space-y-4"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <div>
            <span className="font-semibold">SKU:</span> <span className="font-mono">{task.sku}</span>
          </div>
          <div>
            <span className="font-semibold">Task quantity:</span> {task.quantity}
          </div>
          <div>
            <span className="font-semibold">Assigned to:</span> {task.assignedTo ?? '—'}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Destination bin</span>
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="text-xs font-semibold text-indigo-700 hover:underline"
            >
              {pickerOpen ? 'Close list' : 'Choose different bin'}
            </button>
          </div>

          <div className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono">
            {chosenBin ? chosenBin.fullCode : '— select a bin —'}
          </div>

          {pickerOpen && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-2">
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-xs font-mono"
                  placeholder="Search bins (FAST, A-01)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No bins match.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filtered.map((b) => {
                    const free = b.capacityUnits - b.currentUtilization;
                    const canHold = free >= qtyNum;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!canHold}
                        onClick={() => {
                          setBinId(b.id);
                          setPickerOpen(false);
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${
                          canHold ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-40'
                        } ${binId === b.id ? 'bg-indigo-50' : ''}`}
                      >
                        <span className="font-mono font-semibold">{b.fullCode}</span>
                        <span className="text-slate-500">
                          {free} free / {b.capacityUnits}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <Field label={`Quantity placed (max ${task.quantity})`}>
          <input
            required
            type="number"
            min={1}
            max={task.quantity}
            className={inputCls}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>

        {!qtyValid && quantity !== '' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            Quantity must be between 1 and {task.quantity}.
          </div>
        )}

        {chosenBin && qtyValid && !binHasRoom && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {chosenBin.fullCode} only has {chosenBin.capacityUnits - chosenBin.currentUtilization} units free —
            not enough for {qtyNum}.
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Confirm placement
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SlottingTab() {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('');
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [skus, setSkus] = useState<SkuOption[]>([]);
  const [loadingSkus, setLoadingSkus] = useState(true);

  useEffect(() => {
    api<{ data: any[] }>(`${INVENTORY_API}/inventory?limit=200`)
      .then((body) => {
        const rows = Array.isArray(body?.data) ? body.data : [];
        const seen = new Set<string>();
        const unique: SkuOption[] = [];
        for (const r of rows) {
          if (!r?.sku || seen.has(r.sku)) continue;
          seen.add(r.sku);
          unique.push({
            sku: r.sku,
            productName: r.productName ?? r.sku,
            velocity: r.salesVelocity ?? null,
          });
        }
        setSkus(unique);
      })
      .catch(() => setSkus([]))
      .finally(() => setLoadingSkus(false));
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const body = await api<SuggestResult>(`${WAREHOUSE_API}/putaway/suggest`, {
        method: 'POST',
        body: JSON.stringify({ sku, quantity: Number(quantity) }),
      });
      setResult(body);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-xs font-medium text-slate-500">Slotting</div>
        <h3 className="mt-0.5 mb-1 text-sm font-semibold text-slate-800"></h3>
        <p className="mb-4 text-xs text-slate-500">
          
        </p>
        <form onSubmit={submit} className="grid grid-cols-[1fr_120px_auto] items-end gap-3">
          <Field label="SKU">
            <select
              required
              className={`${inputCls} font-mono`}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            >
              <option value="">{loadingSkus ? 'Loading SKUs…' : '— Select a SKU —'}</option>
              {skus.map((s) => (
                <option key={s.sku} value={s.sku}>
                  {s.sku}
                  {s.velocity ? ` · ${s.velocity}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantity">
            <input
              required
              type="number"
              min={1}
              className={inputCls}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <button
            type="submit"
            disabled={busy || !sku}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Consulting…' : 'Suggest bin'}
          </button>
        </form>
      </div>

      {error && <Banner kind="error" text={error} onClose={() => setError(null)} />}

      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Pill tone="blue">Zone: {result.zone}</Pill>
            {result.bin && <Pill tone="green">Bin: {result.bin.fullCode}</Pill>}
          </div>
          <p className="mb-4 text-sm text-slate-600">{result.reason}</p>
          {result.bin && (
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-slate-500">Capacity</div>
                <div className="text-lg font-semibold text-slate-900">{result.bin.capacityUnits}</div>
              </div>
              <div>
                <div className="text-slate-500">In use</div>
                <div className="text-lg font-semibold text-slate-900">{result.bin.currentUtilization}</div>
              </div>
              <div>
                <div className="text-slate-500">Free</div>
                <div className="text-lg font-semibold text-green-700">
                  {result.bin.capacityUnits - result.bin.currentUtilization}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Zone</div>
                <div className="text-lg font-semibold text-slate-900">{result.zone}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}