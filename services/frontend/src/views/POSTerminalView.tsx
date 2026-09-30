import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { Banner } from '../components/ui';
import { api } from '../api';

type PaymentMethod = 'Cash' | 'Card' | 'Gift Card' | 'Split';

type CatalogItem = {
  sku: string;
  name: string;
  price: number;
  category: string;
};

type CartItem = CatalogItem & {
  qty: number;
};

const RETAIL_SALES_API = `${import.meta.env.VITE_RETAIL_SALES_API ?? 'http://localhost:3006'}/api/retail-sales`;
const INVENTORY_API = `${import.meta.env.VITE_INVENTORY_API ?? 'http://localhost:3003'}/api/inventory`;

const paymentMethodCode = (method: PaymentMethod): string => {
  if (method === 'Cash') return 'CASH';
  if (method === 'Card') return 'CARD';
  if (method === 'Gift Card') return 'GIFT_CARD';
  return 'MIXED';
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
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

const normalizeSku = (
  raw: Record<string, unknown>,
): CatalogItem | null => {
  const sku = raw.sku ?? raw.SKU ?? raw.productCode;
  if (!sku) return null;

  const price = toNumber(
    raw.unitPrice ?? raw.unit_price ?? raw.price ?? raw.retailPrice,
  );

  const name = raw.productName ?? raw.product_name ?? raw.name ?? sku;

  const category =
    raw.category ?? raw.productCategory ?? raw.product_category ?? '—';

  return {
    sku: String(sku),
    name: String(name),
    price,
    category: String(category),
  };
};

export default function POSTerminalView() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scan, setScan] = useState('');
  const [storeId, setStoreId] = useState(
    import.meta.env.VITE_STORE_ID ?? 'STORE-01',
  );
  const [registerId, setRegisterId] = useState(
    import.meta.env.VITE_REGISTER_ID ?? 'REG-01',
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>('Card');

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      // Pull inventory records. Every sellable SKU lives here.
      const response = await api(`${INVENTORY_API}?limit=100`);
      const rows = extractRows(response);

      const normalized = rows
        .map(normalizeSku)
        .filter((item): item is CatalogItem => item !== null);

      // Deduplicate by SKU — inventory can have multiple locations
      // per SKU; we only want one entry per product in the POS.
      const deduped = new Map<string, CatalogItem>();
      for (const item of normalized) {
        if (!deduped.has(item.sku)) {
          deduped.set(item.sku, item);
        }
      }

      setCatalog(Array.from(deduped.values()));
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'Unable to load SKU list.';
      setCatalogError(
        `Inventory service unavailable — ${message}. Retry to load SKUs.`,
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    void loadCatalog();
  }, []);

  const filteredCatalog = useMemo(() => {
    const query = scan.trim().toLowerCase();
    if (!query) return [];
    return catalog.filter(
      (item) =>
        item.sku.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query),
    );
  }, [scan, catalog]);

  const scannedItem = useMemo(
    () =>
      catalog.find(
        (item) => item.sku.toLowerCase() === scan.trim().toLowerCase(),
      ),
    [scan, catalog],
  );

  const addItemToCart = (item: CatalogItem) => {
    setError(null);
    setCart((current) => {
      const existing = current.find((entry) => entry.sku === item.sku);
      if (existing) {
        return current.map((entry) =>
          entry.sku === item.sku
            ? { ...entry, qty: entry.qty + 1 }
            : entry,
        );
      }
      return [...current, { ...item, qty: 1 }];
    });
    setScan('');
  };

  const changeQty = (sku: string, delta: number) => {
    setCart((current) =>
      current
        .map((entry) =>
          entry.sku === sku
            ? { ...entry, qty: Math.max(0, entry.qty + delta) }
            : entry,
        )
        .filter((entry) => entry.qty > 0),
    );
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.qty * item.price,
    0,
  );
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;

  const handleProcessPayment = async () => {
    if (cart.length === 0) {
      setError('Add at least one item before processing payment.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsProcessing(true);

    const saleId = `SALE-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    try {
      for (const item of cart) {
        await api(`${RETAIL_SALES_API}/sales`, {
          method: 'POST',
          body: JSON.stringify({
            saleId,
            storeId,
            registerId,
            cashierId: 'CASHIER-01',
            customerId: 'CUST-WALKIN',
            sku: item.sku,
            quantity: item.qty,
            unitPrice: String(item.price),
            totalAmount: String(item.qty * item.price),
            paymentMethod: paymentMethodCode(paymentMethod),
          }),
        });
      }

      setCart([]);
      setSuccess(
        `Sale ${saleId} recorded. The event is published to Sales Audit and Financials automatically.`,
      );
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'Unable to process payment.';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCatalogPanel = () => {
    if (catalogLoading) {
      return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      );
    }

    if (catalogError) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>{catalogError}</span>
          <button
            type="button"
            onClick={() => void loadCatalog()}
            className="ml-3 inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      );
    }

    if (catalog.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          No sellable items yet. Add inventory records first, then refresh.
        </div>
      );
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => (
          <button
            key={item.sku}
            type="button"
            onClick={() => addItemToCart(item)}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
          >
            <div>
              <div className="text-sm font-medium text-slate-800">
                {item.name}
              </div>
              <div className="text-[11px] text-slate-500">{item.sku}</div>
            </div>
            <div className="text-sm font-semibold text-slate-800">
              KES {item.price.toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Checkout
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            POS terminal
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <span className="font-medium">Store</span>
            <input
              value={storeId}
              onChange={(event) => setStoreId(event.target.value)}
              className="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:border-indigo-400"
            />
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <span className="font-medium">Register</span>
            <input
              value={registerId}
              onChange={(event) => setRegisterId(event.target.value)}
              className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none focus:border-indigo-400"
            />
          </label>

          <button
            type="button"
            onClick={() => void loadCatalog()}
            disabled={catalogLoading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh SKUs
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        These identify which branch and till this sale belongs to. The
        system records the sale against this store and register.
      </div>

      {error && (
        <Banner kind="error" text={error} onClose={() => setError(null)} />
      )}
      {success && (
        <Banner
          kind="success"
          text={success}
          onClose={() => setSuccess(null)}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ShoppingBag className="h-4 w-4" /> Active cart
            </div>
            <button
              onClick={() => setCart([])}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No items in cart yet. Scan or search an SKU to begin.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div>
                    <div className="font-medium text-slate-900">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.sku} • {item.category}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                      <button
                        type="button"
                        onClick={() => changeQty(item.sku, -1)}
                        className="h-5 w-5 text-slate-600"
                      >
                        −
                      </button>
                      <span className="min-w-4 text-center text-sm font-semibold text-slate-800">
                        {item.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQty(item.sku, 1)}
                        className="h-5 w-5 text-slate-600"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-slate-900">
                        KES {(item.qty * item.price).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500">
                        KES {item.price.toLocaleString()} each
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              value={scan}
              onChange={(event) => setScan(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && scannedItem) {
                  addItemToCart(scannedItem);
                }
              }}
              placeholder="Scan or search SKU"
            />
            {scannedItem && (
              <button
                type="button"
                onClick={() => addItemToCart(scannedItem)}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            )}
          </div>

          {scan && !scannedItem && filteredCatalog.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No matching item found. Try one of the listed SKUs or search
              by product name.
            </div>
          )}

          {scan && filteredCatalog.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Matching items
              </div>
              <div className="space-y-2">
                {filteredCatalog.slice(0, 4).map((item) => (
                  <button
                    key={item.sku}
                    type="button"
                    onClick={() => addItemToCart(item)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.sku}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      KES {item.price.toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-slate-800">
                  KES {subtotal.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tax</span>
                <span className="font-medium text-slate-800">
                  KES {tax.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span>KES {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['Cash', 'Card', 'Gift Card', 'Split'] as PaymentMethod[]).map(
              (method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                    paymentMethod === method
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {method}
                </button>
              ),
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Payment:</span>{' '}
            {paymentMethod}
          </div>

          <button
            onClick={handleProcessPayment}
            disabled={isProcessing || cart.length === 0}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? 'Processing sale…' : 'Process payment'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-700">
            Available items
          </div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            {catalogLoading ? 'Loading…' : `${catalog.length} SKUs`}
          </div>
        </div>
        {renderCatalogPanel()}
      </div>
    </div>
  );
}