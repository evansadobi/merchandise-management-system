import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Bell,
  Boxes,
  Building2,
  ClipboardList,
  Landmark,
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Truck,
  Warehouse,
} from 'lucide-react';
import { api } from '../api';

export type ViewKey =
  | 'vendors'
  | 'procurement'
  | 'receiving'
  | 'inventory'
  | 'warehouse'
  | 'pos'
  | 'audit'
  | 'finance';

export const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: typeof Package }> = [
  { key: 'vendors', label: 'Vendors', icon: Building2 },
  { key: 'procurement', label: 'Procurement', icon: ClipboardList },
  { key: 'receiving', label: 'Receiving', icon: Truck },
  { key: 'inventory', label: 'Inventory', icon: Boxes },
  { key: 'warehouse', label: 'Warehouse', icon: Warehouse },
  { key: 'pos', label: 'POS', icon: ShoppingCart },
  { key: 'audit', label: 'Audit', icon: Landmark },
  { key: 'finance', label: 'Finance', icon: Landmark },
];


type SearchResult = {
  id: string;
  kind: 'vendor' | 'po' | 'grn' | 'sku' | 'sale';
  title: string;
  subtitle: string;
  view: ViewKey;
};

const VENDOR_API = import.meta.env.VITE_VENDOR_API ?? 'http://localhost:3001';
const PROCUREMENT_API = import.meta.env.VITE_PROCUREMENT_API ?? 'http://localhost:3002';
const INVENTORY_API = import.meta.env.VITE_INVENTORY_API ?? 'http://localhost:3003';
const RECEIVING_API = import.meta.env.VITE_RECEIVING_API ?? 'http://localhost:3004';
const RETAIL_SALES_API = import.meta.env.VITE_RETAIL_SALES_API ?? 'http://localhost:3006';

const KIND_LABEL: Record<string, string> = {
  vendor: 'Vendor',
  po: 'Purchase Order',
  grn: 'GRN',
  sku: 'SKU',
  sale: 'Sale',
};

const KIND_STYLE: Record<string, string> = {
  vendor: 'bg-blue-100 text-blue-700',
  po: 'bg-purple-100 text-purple-700',
  grn: 'bg-emerald-100 text-emerald-700',
  sku: 'bg-amber-100 text-amber-700',
  sale: 'bg-indigo-100 text-indigo-700',
};

const extractRows = (response: unknown): Record<string, unknown>[] => {
  if (Array.isArray(response)) return response as Record<string, unknown>[];
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    Array.isArray((response as { data: unknown }).data)
  ) {
    return (response as { data: Record<string, unknown>[] }).data;
  }
  return [];
};

const matches = (value: unknown, query: string): boolean =>
  String(value ?? '').toLowerCase().includes(query.toLowerCase());


function useGlobalSearch(query: string) {
  const [all, setAll] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      try {
        const [vendors, pos, inventory, grns, sales] = await Promise.allSettled([
          api(`${VENDOR_API}/api/vendors?limit=100`).catch(() => []),
          api(`${PROCUREMENT_API}/api/purchase-orders`).catch(() => []),
          api(`${INVENTORY_API}/api/inventory?limit=100`).catch(() => []),
          api(`${RECEIVING_API}/api/grn?limit=100`).catch(() => []),
          api(`${RETAIL_SALES_API}/api/retail-sales/sales`).catch(() => []),
        ]);

        if (cancelled) return;

        const merged: SearchResult[] = [];

        if (vendors.status === 'fulfilled') {
          for (const v of extractRows(vendors.value)) {
            merged.push({
              id: String(v.id ?? ''),
              kind: 'vendor',
              title: String(v.name ?? 'Unnamed vendor'),
              subtitle: `Vendor · ${v.status ?? 'unknown'} · ${v.paymentTerms ?? ''}`,
              view: 'vendors',
            });
          }
        }

        if (pos.status === 'fulfilled') {
          for (const p of extractRows(pos.value)) {
            merged.push({
              id: String(p.id ?? ''),
              kind: 'po',
              title: `PO ${String(p.id ?? '').slice(0, 8)} · ${p.sku ?? ''}`,
              subtitle: `Procurement · ${p.status ?? ''} · qty ${p.quantityOrdered ?? ''}`,
              view: 'procurement',
            });
          }
        }

        if (inventory.status === 'fulfilled') {
          for (const it of extractRows(inventory.value)) {
            merged.push({
              id: String(it.id ?? ''),
              kind: 'sku',
              title: `${it.sku ?? ''} · ${it.productName ?? ''}`,
              subtitle: `Inventory · ${it.quantityOnHand ?? 0} on hand at ${it.locationId ?? ''}`,
              view: 'inventory',
            });
          }
        }

        if (grns.status === 'fulfilled') {
          for (const g of extractRows(grns.value)) {
            merged.push({
              id: String(g.id ?? ''),
              kind: 'grn',
              title: `GRN ${String(g.id ?? '').slice(0, 8)}`,
              subtitle: `Receiving · ${g.status ?? ''}`,
              view: 'receiving',
            });
          }
        }

        if (sales.status === 'fulfilled') {
          for (const s of extractRows(sales.value)) {
            merged.push({
              id: String(s.id ?? s.saleId ?? ''),
              kind: 'sale',
              title: `Sale ${String(s.saleId ?? s.id ?? '').slice(0, 16)}`,
              subtitle: `POS · ${s.storeId ?? ''} · ${s.paymentMethod ?? ''}`,
              view: 'pos',
            });
          }
        }

        setAll(merged);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAll();
    const interval = setInterval(() => void loadAll(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return all
      .filter(
        (r) =>
          matches(r.title, q) ||
          matches(r.subtitle, q) ||
          matches(r.id, q) ||
          matches(r.kind, q),
      )
      .slice(0, 12);
  }, [query, all]);

  return { results, loading };
}


export function Layout({
  activeView,
  onSelect,
  children,
}: {
  activeView: ViewKey;
  onSelect: (key: ViewKey) => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const { results, loading } = useGlobalSearch(query);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (index: number) => {
    const result = results[index];
    if (!result) return;
    onSelect(result.view);
    setQuery('');
    setOpen(false);
    setHighlighted(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      handleSelect(highlighted);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="w-72 shrink-0 border-r border-slate-200 bg-slate-950 p-4 text-slate-200">
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">MMS</div>
            <div className="text-sm font-semibold text-white">Retail Ops</div>
          </div>
          <div className="rounded-full bg-indigo-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200">
            Live
          </div>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                activeView === key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3" ref={boxRef}>
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    setHighlighted(0);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm text-slate-700 outline-none ring-0 focus:border-indigo-400 focus:bg-white"
                  placeholder="Search SKU, PO, GRN, sale or vendor"
                />
                {loading && (
                  <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                {!loading && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    ⌘K
                  </span>
                )}

                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {results.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        {loading ? 'Searching…' : `No results for "${query}"`}
                      </div>
                    ) : (
                      <ul className="py-1">
                        {results.map((r, i) => (
                          <li key={`${r.kind}-${r.id}-${i}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setHighlighted(i)}
                              onClick={() => handleSelect(i)}
                              className={`flex w-full items-start gap-3 px-3 py-2 text-left transition ${
                                highlighted === i ? 'bg-indigo-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span
                                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  KIND_STYLE[r.kind] ?? 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {KIND_LABEL[r.kind] ?? r.kind}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-slate-800">
                                  {r.title}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {r.subtitle}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}