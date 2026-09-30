import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { inventoryService } from "../../services/InventoryService.js";
import { toStockLevelProto } from "../stockMapper.js";

export async function releaseReservation(
  call: ServerUnaryCall<
    { saleId: string; sku: string; locationId: string; quantity: number },
    unknown
  >,
  callback: sendUnaryData<{
    released: boolean;
    stock: ReturnType<typeof toStockLevelProto>;
  }>,
) {
  const { saleId, sku, locationId } = call.request;

  const result = await inventoryService.releaseForSale(saleId, sku, locationId);

  callback(null, {
    released: Boolean(result.released),
    stock: toStockLevelProto(result.stock),
  });
}
