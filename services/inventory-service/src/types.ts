export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export interface InventoryItem {
  id: string;
  productName: string;
  sku: string;
  locationId: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityOnOrder: number;
  unitValue: string;
  reorderLevel: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInventoryDTO {
  productName: string;
  sku: string;
  locationId?: string;
  quantityOnHand?: number;
  unitValue?: string;
  reorderLevel?: number;
}

export function computeAvailable(
  item: Pick<InventoryItem, "quantityOnHand" | "quantityAllocated">,
) {
  return item.quantityOnHand - item.quantityAllocated;
}

export function computeTotalValue(
  item: Pick<InventoryItem, "quantityOnHand" | "unitValue">,
) {
  const total = Number(item.unitValue) * item.quantityOnHand;
  return total.toFixed(2);
}
