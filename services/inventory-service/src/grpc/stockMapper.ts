type InventoryStockRow = {
  sku: string;
  locationId: string;
  quantityOnHand: number | string;
  quantityAllocated: number | string;
  quantityOnOrder?: number | string;
};

export function toStockLevelProto(stock: InventoryStockRow | null) {
  if (!stock) {
    return null;
  }

  const quantityOnHand = Number(stock.quantityOnHand ?? 0);
  const quantityAllocated = Number(stock.quantityAllocated ?? 0);
  const quantityAvailable = Math.max(quantityOnHand - quantityAllocated, 0);

  return {
    sku: stock.sku,
    locationId: stock.locationId,
    quantityOnHand,
    quantityAllocated,
    quantityAvailable,
  };
}
