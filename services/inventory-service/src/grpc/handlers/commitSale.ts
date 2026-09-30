import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { inventoryService } from "../../services/InventoryService.js";
import { toStockLevelProto } from "../stockMapper.js";

export async function commitSale(
  call: ServerUnaryCall<
    { saleId: string; sku: string; locationId: string; quantity: number },
    unknown
  >,
  callback: sendUnaryData<{
    committed: boolean;
    stock: ReturnType<typeof toStockLevelProto>;
    failureReason: string;
  }>,
) {
  const { saleId, sku, locationId, quantity } = call.request;

  const result = await inventoryService.commitForSale(
    saleId,
    sku,
    locationId,
    Number(quantity ?? 0),
  );

  callback(null, {
    committed: Boolean(result.committed),
    stock: toStockLevelProto(result.stock),
    failureReason: result.failureReason ?? "",
  });
}
