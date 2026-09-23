import { UpstreamServiceError } from "../types.js";

export interface VendorSupplierMatch {
  vendorId: string;
  vendorName: string;
  paymentTerms: string;
  leadTimeDays: number;
  unitCost: string;
}

const FETCH_TIMEOUT_MS = 5000;

export class VendorServiceClient {
  constructor(
    private baseUrl: string = process.env.VENDOR_SERVICE_URL ||
      "http://localhost:3001",
  ) {}

  async getApprovedSuppliersForSku(
    sku: string,
  ): Promise<VendorSupplierMatch[]> {
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/vendors/sku/${encodeURIComponent(sku)}/suppliers`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      );
    } catch (fetchError) {
      throw new UpstreamServiceError("Vendor Service is unavailable", 502);
    }

    if (!response.ok) {
      throw new UpstreamServiceError(
        "Failed to verify vendor product catalog",
        502,
      );
    }

    return (await response.json()) as VendorSupplierMatch[];
  }
}
