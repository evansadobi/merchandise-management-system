import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'center' | 'right';
}

export interface BulkAction {
  label: string;
  tone?: 'default' | 'danger';
  onClick: (ids: string[]) => void | Promise<void>;
}

export interface FilterDef<T> {
  label: string; // shown as the "All …" option
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowId: (row: T) => string;
  searchText: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  bulkActions?: BulkAction[];
  rowActions?: (row: T) => ReactNode;
  pageSize?: number;
  noun: string; // e.g. "vendors"
  loading?: boolean;
  error?: string | null;
}

const alignCls = { left: 'text-left', center: 'text-center', right: 'text-right' };

export default function DataTable<T>({
  rows, columns, rowId, searchText, searchPlaceholder = 'Search', filters = [],
  bulkActions = [], rowActions, pageSize = 10, noun, loading, error,
}: Props<T>) {
  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<string[]>(filters.map(() => 'all'));
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  let visible = rows.filter((r) => searchText(r).toLowerCase().includes(query.toLowerCase()));
  filters.forEach((f, i) => {
    if (filterValues[i] && filterValues[i] !== 'all') {
      visible = visible.filter((r) => f.predicate(r, filterValues[i]));
    }
  });
  if (sort) {
    const sv = columns.find((c) => c.key === sort.key)?.sortValue;
    if (sv) {
      visible = [...visible].sort((a, b) => {
        const x = sv(a), y = sv(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
  }

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const pageRows = visible.slice(safePage * pageSize, safePage * pageSize + pageSize);

  // Drop selections for rows that no longer exist (e.g. after a delete/reload).
  const existing = new Set(rows.map(rowId));
  const selectedIds = [...selected].filter((id) => existing.has(id));

  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(rowId(r)));
  const someOnPage = pageRows.some((r) => selected.has(rowId(r)));

  const toggleAll = () => {
    const next = new Set(selected);
    pageRows.forEach((r) => (allOnPage ? next.delete(rowId(r)) : next.add(rowId(r))));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));

  const runBulk = async (a: BulkAction) => {
    setBusy(true);
    try {
      await a.onClick(selectedIds);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const selectable = bulkActions.length > 0;
  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        {filters.map((f, i) => (
          <select
            key={f.label}
            value={filterValues[i] ?? 'all'}
            onChange={(e) => {
              const next = [...filterValues];
              next[i] = e.target.value;
              setFilterValues(next);
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">{f.label}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-600">
              {selectable && (
                <th className="w-12 p-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={allOnPage}
                    ref={(el) => { if (el) el.indeterminate = someOnPage && !allOnPage; }}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={`p-4 ${alignCls[c.align ?? 'left']}`}>
                  {c.sortValue ? (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-900">
                      {c.header}
                      <span className="text-slate-400">{sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                    </button>
                  ) : c.header}
                </th>
              ))}
              {rowActions && <th className="p-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading && <tr><td colSpan={colCount} className="p-8 text-center text-slate-400">Loading…</td></tr>}
            {error && <tr><td colSpan={colCount} className="p-8 text-center text-red-600">{error}</td></tr>}
            {!loading && !error && pageRows.length === 0 && (
              <tr><td colSpan={colCount} className="p-8 text-center text-slate-400">No {noun} found.</td></tr>
            )}
            {!loading && !error && pageRows.map((r) => {
              const id = rowId(r);
              return (
                <tr key={id} className={selected.has(id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}>
                  {selectable && (
                    <td className="p-4">
                      <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={selected.has(id)} onChange={() => toggleOne(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`p-4 ${alignCls[c.align ?? 'left']}`}>{c.render(r)}</td>
                  ))}
                  {rowActions && <td className="p-4 text-right">{rowActions(r)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            Displaying
            <select
              value={safePage}
              onChange={(e) => setPage(Number(e.target.value))}
              className="rounded border border-slate-200 bg-white px-2 py-1"
            >
              {Array.from({ length: pages }, (_, i) => <option key={i} value={i}>{i + 1}</option>)}
            </select>
            of {visible.length} {noun}
          </div>
          <div className="flex gap-2">
            <button disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">‹ Prev</button>
            <button disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">Next ›</button>
          </div>
        </div>
      </div>

      {/* Floating selection bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-2xl">
          <span>{selectedIds.length} item{selectedIds.length > 1 ? 's' : ''} selected</span>
          {bulkActions.map((a) => (
            <button
              key={a.label}
              disabled={busy}
              onClick={() => runBulk(a)}
              className={`border-l border-slate-700 pl-4 underline underline-offset-2 disabled:opacity-50 ${a.tone === 'danger' ? 'text-red-400' : ''}`}
            >
              {a.label}
            </button>
          ))}
          <button aria-label="Clear selection" onClick={() => setSelected(new Set())} className="border-l border-slate-700 pl-4 text-slate-400 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
}