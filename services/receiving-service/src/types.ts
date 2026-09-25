import { InferSelectModel, InferInsertModel } from "drizzle-orm";
import {
  expectedDeliveries,
  goodsReceivedNotes,
  receivingItems,
  grnStatusEnum,
  expectedDeliveryStatusEnum,
} from "./db/schema.js";

export type ExpectedDelivery = InferSelectModel<typeof expectedDeliveries>;
export type NewExpectedDelivery = InferInsertModel<typeof expectedDeliveries>;

export type GoodsReceivedNote = InferSelectModel<typeof goodsReceivedNotes>;
export type NewGoodsReceivedNote = InferInsertModel<typeof goodsReceivedNotes>;

export type ReceivingItem = InferSelectModel<typeof receivingItems>;
export type NewReceivingItem = InferInsertModel<typeof receivingItems>;

export type GrnStatus = (typeof grnStatusEnum.enumValues)[number];
export type ExpectedDeliveryStatus =
  (typeof expectedDeliveryStatusEnum.enumValues)[number];
export type DiscrepancyType = "NONE" | "SHORTAGE" | "OVERAGE";

export interface PurchaseOrderApprovedEvent {
  id: string;
  vendorId: string;
  sku: string;
  quantity: number;
}

export interface GoodsReceivedEventPayload {
  grnId: string;
  purchaseOrderId: string;
  sku: string;
  quantity: number;
}

export interface ReceivingItemInput {
  sku: string;
  receivedQuantity: number;
  damagedQuantity?: number;
  conditionNotes?: string;
}

export interface CreateGrnDTO {
  purchaseOrderId: string;
  supplierId: string;
  receivedBy: string;
  items: ReceivingItemInput[];
}

export interface PreparedItem {
  expectedDeliveryId: string | null;
  sku: string;
  orderedQuantity: number;
  receivedQuantity: number;
  damagedQuantity: number;
  conditionNotes?: string;
  discrepancyType: DiscrepancyType;
  sellableQuantity: number;
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
