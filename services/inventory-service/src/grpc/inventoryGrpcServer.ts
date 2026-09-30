import * as grpc from "@grpc/grpc-js";
import { mapInventoryError } from "./errorMapper.js";
import { InventoryService } from "./protoLoader.js";
import { batchCheckStock } from "./handlers/batchCheckStock.js";
import { checkStock } from "./handlers/checkStock.js";
import { commitSale } from "./handlers/commitSale.js";
import { releaseReservation } from "./handlers/releaseReservation.js";
import { reserveStock } from "./handlers/reserveStock.js";

const server = new grpc.Server();
const GRPC_PORT = Number(process.env.GRPC_PORT) || 50051;
let grpcServerStarted = false;

function withErrorTranslation<
  T extends (...args: any[]) => Promise<void> | void,
>(handler: T): T {
  return ((call: any, callback: any) => {
    Promise.resolve(handler(call, callback)).catch((error: unknown) => {
      callback(mapInventoryError(error), null);
    });
  }) as T;
}

const inventoryHandlers = {
  checkStock: withErrorTranslation(checkStock),
  batchCheckStock: withErrorTranslation(batchCheckStock),
  reserveStock: withErrorTranslation(reserveStock),
  releaseReservation: withErrorTranslation(releaseReservation),
  commitSale: withErrorTranslation(commitSale),
};

export async function startInventoryGrpcServer() {
  if (grpcServerStarted) {
    return server;
  }

  server.addService(InventoryService.service, inventoryHandlers);

  await new Promise<void>((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, boundPort) => {
        if (err) {
          reject(err);
          return;
        }

        if (boundPort === 0 || boundPort === undefined) {
          reject(new Error("gRPC server did not bind to a port."));
          return;
        }

        resolve();
      },
    );
  });

  server.start();
  grpcServerStarted = true;
  console.log(`Inventory gRPC server listening on port ${GRPC_PORT}`);
  return server;
}

export function stopInventoryGrpcServer() {
  if (grpcServerStarted) {
    server.forceShutdown();
    grpcServerStarted = false;
  }
}
