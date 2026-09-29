import { UpstreamServiceError } from "../types.js";

export interface PurchaseOrderDetails {
  id: string;
  vendorId: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  status: "DRAFT" | "APPROVED" | "PARTIALLY_RECEIVED" | "RECEIVED";
}

const FETCH_TIMEOUT_MS = 5000;

export class ProcurementServiceClient {
  constructor(
    private baseUrl: string = process.env.PROCUREMENT_SERVICE_URL ||
      "http://localhost:3002",
  ) {}

  async getPurchaseOrder(id: string): Promise<PurchaseOrderDetails | null> {
    let response: globalThis.Response;
    try {
      response = await fetch(`${this.baseUrl}/api/purchase-orders/${id}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (fetchError) {
      throw new UpstreamServiceError("Procurement Service is unavailable", 502);
    }

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new UpstreamServiceError(
        "Failed to verify purchase order with Procurement Service",
        502,
      );
    }

    return (await response.json()) as PurchaseOrderDetails;
  }

  /**
   * Tells Procurement how much physically arrived, so its own
   * quantityReceived/status tracking stays in sync with reality even
   * though nothing else calls this automatically. Uses PATCH, matching
   * Procurement's actual route (router.patch("/:id/receive", ...)) —
   * calling this with POST would 404/405 against the real API.
   */
  async recordReceipt(
    purchaseOrderId: string,
    quantityReceived: number,
  ): Promise<void> {
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/purchase-orders/${purchaseOrderId}/receive`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantityReceived }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );
    } catch (fetchError) {
      throw new UpstreamServiceError("Procurement Service is unavailable", 502);
    }

    if (!response.ok) {
      throw new UpstreamServiceError(
        "Failed to update purchase order receipt status in Procurement Service",
        502,
      );
    }
  }
}
