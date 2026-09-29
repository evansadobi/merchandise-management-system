import { UpstreamServiceError } from "../types.js";

const BASE_URL = process.env.INVENTORY_SERVICE_URL || "http://localhost:3003";

export class InventoryServiceClient {
  async getSkuAttributes(sku: string): Promise<{
    sku: string;
    locationId: string;
    salesVelocity: string | null;
    weightKg: string | null;
    volumeCm3: number | null;
  } | null> {
    try {
      const res = await fetch(
        `${BASE_URL}/api/inventory/sku/${encodeURIComponent(sku)}`,
      );

      if (res.status === 404) return null;
      if (!res.ok) {
        throw new UpstreamServiceError(
          `Inventory returned ${res.status} for SKU ${sku}`,
        );
      }

      const rows = (await res.json()) as Array<{
        sku: string;
        locationId: string;
        salesVelocity: string | null;
        weightKg: string | null;
        volumeCm3: number | null;
      }>;

      if (rows.length === 0) return null;

      const withVelocity = rows.find((r) => r.salesVelocity !== null);
      return withVelocity ?? rows[0]!;
    } catch (err) {
      if (err instanceof UpstreamServiceError) throw err;
      throw new UpstreamServiceError(
        `Inventory service unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async transferStock(data: {
    sku: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
  }) {
    const res = await fetch(`${BASE_URL}/api/inventory/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        (body as any)?.error ??
        (body as any)?.message ??
        `Inventory returned ${res.status}`;
      throw new UpstreamServiceError(message, res.status);
    }

    return res.json();
  }
}
