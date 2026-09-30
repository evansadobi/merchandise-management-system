import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { inventoryService } from "../../services/InventoryService.js";
import { toStockLevelProto } from "../stockMapper.js";

export async function checkStock(
  call: ServerUnaryCall<
    { sku: string; locationId: string; requestedQuantity: number },
    unknown
  >,
  callback: sendUnaryData<{
    stock: ReturnType<typeof toStockLevelProto>;
    isAvailable: boolean;
  }>,
) {
  const { sku, locationId, requestedQuantity } = call.request;

  const result = await inventoryService.checkStock(
    sku,
    locationId,
    Number(requestedQuantity ?? 0),
  );

  callback(null, {
    stock: toStockLevelProto(result.stock),
    isAvailable: Boolean(result.isAvailable),
  });
}
