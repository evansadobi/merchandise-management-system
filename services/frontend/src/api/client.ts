import { ApiError } from "./errors";

const DEFAULT_TIMEOUT_MS = 12000;

export type ServiceName =
  | "Vendor service"
  | "Procurement service"
  | "Receiving service"
  | "Inventory service"
  | "Warehouse service"
  | "Retail sales service"
  | "Sales audit service"
  | "Financials service";

export type ApiRequestConfig = RequestInit & {
  timeoutMs?: number;
  service?: ServiceName;
};

function timeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), {
    once: true,
  });
  return controller.signal;
}

export async function apiClient<T>(
  url: string,
  init: ApiRequestConfig = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    service = "Vendor service",
    headers,
    ...rest
  } = init;

  const response = await fetch(url, {
    ...rest,
    method: rest.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
    },
    signal: timeoutSignal(timeoutMs),
  });

  const payload = await response.text();
  const body = payload ? JSON.parse(payload) : null;

  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : (body?.message ?? `Request failed with status ${response.status}`);
    throw new ApiError(
      service,
      response.status,
      `${service} unavailable — ${message}`,
      body,
    );
  }

  return (body as T) ?? ({} as T);
}

export const endpoints = {
  vendors: `${import.meta.env.VITE_VENDOR_API ?? "http://localhost:3001/api"}/vendors`,
  procurement: `${import.meta.env.VITE_PROCUREMENT_API ?? "http://localhost:3002/api"}/purchase-orders`,
  receiving: `${import.meta.env.VITE_RECEIVING_API ?? "http://localhost:3004/api"}`,
  inventory: `${import.meta.env.VITE_INVENTORY_API ?? "http://localhost:3003/api"}/inventory`,
  warehouse: `${import.meta.env.VITE_WAREHOUSE_API ?? "http://localhost:3005/api"}`,
  retailSales: `${import.meta.env.VITE_RETAIL_SALES_API ?? "http://localhost:3006/api"}/retail-sales`,
  salesAudit: `${import.meta.env.VITE_SALES_AUDIT_API ?? "http://localhost:3007/api"}/sales-audit`,
  financials: `${import.meta.env.VITE_FINANCIALS_API ?? "http://localhost:3008/api"}/financials`,
};
