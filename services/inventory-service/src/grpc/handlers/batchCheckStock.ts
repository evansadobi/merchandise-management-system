import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js";
import { inventoryService } from "../../services/InventoryService.js";
import { toStockLevelProto } from "../stockMapper.js";

export async function batchCheckStock(
  call: ServerUnaryCall<
    {
      items: Array<{
        sku: string;
        locationId: string;
        requestedQuantity: number;
      }>;
    },
    unknown
  >,
  callback: sendUnaryData<{
    results: Array<{
      sku: string;
      stock: ReturnType<typeof toStockLevelProto>;
      isAvailable: boolean;
    }>;
  }>,
) {
  const items = call.request.items ?? [];

  const results = await inventoryService.batchCheckStock(
    items.map((item) => ({
      sku: item.sku,
      locationId: item.locationId,
      requestedQuantity: Number(item.requestedQuantity ?? 0),
    })),
  );

  callback(null, {
    results: results.map((result) => ({
      sku: result.sku,
      stock: toStockLevelProto(result.stock),
      isAvailable: Boolean(result.isAvailable),
    })),
  });
}
