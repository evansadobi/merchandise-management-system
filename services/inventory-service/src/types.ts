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
