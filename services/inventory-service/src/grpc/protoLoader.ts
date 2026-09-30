import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(
  __dirname,
  "../../../../contracts/proto/inventory.proto",
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

export const inventoryGrpc = grpc.loadPackageDefinition(packageDefinition) as {
  mms?: {
    inventory?: {
      v1?: {
        InventoryService?: any;
      };
    };
  };
};

export const inventoryServiceDefinition =
  inventoryGrpc.mms?.inventory?.v1 ?? {};

export const InventoryService = inventoryServiceDefinition.InventoryService;
