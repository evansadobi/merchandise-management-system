import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { inventoryService } from "../../services/InventoryService.js";
import { toStockLevelProto } from "../stockMapper.js";

export async function reserveStock(
  call: ServerUnaryCall<
    { saleId: string; sku: string; locationId: string; quantity: number },
    unknown
  >,
  callback: sendUnaryData<{
    reserved: boolean;
    stock: ReturnType<typeof toStockLevelProto>;
    failureReason: string;
  }>,
) {
  const { saleId, sku, locationId, quantity } = call.request;

  const result = await inventoryService.reserveForSale(
    saleId,
    sku,
    locationId,
    Number(quantity ?? 0),
  );

  callback(null, {
    reserved: Boolean(result.reserved),
    stock: toStockLevelProto(result.stock),
    failureReason: result.failureReason ?? "",
  });
}
