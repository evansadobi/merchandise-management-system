import axios from "axios";

export class ProcurementServiceClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.PROCUREMENT_SERVICE_URL ||
      "http://localhost:3002/api/purchase-orders";
  }

  async getPurchaseOrder(purchaseOrderId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/${purchaseOrderId}`);
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch purchase order ${purchaseOrderId} from Procurement service:`,
        error,
      );
      throw new Error(
        "Unable to verify Purchase Order with Procurement Service.",
      );
    }
  }
}
