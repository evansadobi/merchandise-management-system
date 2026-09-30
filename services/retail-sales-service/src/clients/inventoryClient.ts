export async function validateStock(
  sku: string,
  locationId: string,
  quantity: number,
) {
  return {
    available: true,
    sku,
    locationId,
    requestedQuantity: quantity,
  };
}
