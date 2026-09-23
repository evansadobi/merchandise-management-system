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

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class UpstreamServiceError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = "UpstreamServiceError";
  }
}
