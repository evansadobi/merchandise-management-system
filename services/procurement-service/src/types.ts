export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED";

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
  paymentTerms: string;
  status: PurchaseOrderStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePurchaseOrderDTO {
  vendorId: string;
  sku: string;
  quantity: number;
}
