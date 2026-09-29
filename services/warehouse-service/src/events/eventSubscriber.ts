import RedisModule from "ioredis";
import { WarehouseService } from "../services/WarehouseService.js";
import { featureFlags } from "../config/featureFlags.js";

const Redis = RedisModule.default ?? RedisModule;

const RECEIVING_STREAM = "receiving.events";
const CONSUMER_GROUP = "warehouse-service-group";
const CONSUMER_NAME = "warehouse-worker-1";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);
const warehouseService = new WarehouseService();

redis.on("error", (err: unknown) => {
  console.error("Redis subscriber connection error:", err);
});

let keepPolling = true;

async function ensureConsumerGroupExists(streamName: string) {
  try {
    await redis.xgroup("CREATE", streamName, CONSUMER_GROUP, "$", "MKSTREAM");
    console.log(
      `Created consumer group "${CONSUMER_GROUP}" on stream "${streamName}"`,
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BUSYGROUP")) {
      console.log(
        `Consumer group "${CONSUMER_GROUP}" already exists on "${streamName}" — resuming.`,
      );
    } else {
      throw error;
    }
  }
}

function parseFields(fields: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    if (key === undefined || value === undefined) continue;
    parsed[key] = value;
  }
  return parsed;
}

async function handleGoodsReceived(dataRaw: string, entryId: string) {
  const data = JSON.parse(dataRaw) as {
    grnId: string;
    purchaseOrderId: string;
    sku: string;
    quantity: number;
    locationId?: string;
  };

  const task = await warehouseService.handleGoodsReceived({
    grnId: data.grnId,
    purchaseOrderId: data.purchaseOrderId,
    sku: data.sku,
    quantity: data.quantity,
    locationId: data.locationId,
  });

  console.log(
    `[${entryId}] GoodsReceived: putaway task ${task.id} created for SKU ${data.sku} (GRN ${data.grnId})`,
  );
}

async function processEntry(
  streamName: string,
  entryId: string,
  fields: string[],
) {
  const parsed = parseFields(fields);

  if (!parsed.data) {
    console.error(
      `[${entryId}] Event on ${streamName} missing data field, skipping`,
    );
    return;
  }

  if (streamName === RECEIVING_STREAM && parsed.event === "GoodsReceived") {
    await handleGoodsReceived(parsed.data, entryId);
    return;
  }
}

async function pollLoop() {
  while (keepPolling) {
    try {
      const response = await redis.xreadgroup(
        "GROUP",
        CONSUMER_GROUP,
        CONSUMER_NAME,
        "COUNT",
        10,
        "BLOCK",
        5000,
        "STREAMS",
        RECEIVING_STREAM,
        ">",
      );

      if (!response) continue;

      const streams = response as [string, [string, string[]][]][];

      for (const [streamName, entries] of streams) {
        for (const [entryId, fields] of entries) {
          try {
            await processEntry(streamName, entryId, fields);
            await redis.xack(streamName, CONSUMER_GROUP, entryId);
          } catch (processingError) {
            console.error(
              `Failed to process ${streamName} entry ${entryId}, leaving unacknowledged for retry:`,
              processingError,
            );
          }
        }
      }
    } catch (error) {
      console.error("Error reading from event streams, retrying in 5s:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export async function startEventSubscriber() {
  if (!featureFlags.warehouse) {
    console.log(
      "Warehouse event subscriber skipped — FEATURE_WAREHOUSE is disabled",
    );
    return;
  }

  await ensureConsumerGroupExists(RECEIVING_STREAM);
  console.log(
    `Listening on "${RECEIVING_STREAM}" as consumer "${CONSUMER_NAME}" in group "${CONSUMER_GROUP}"`,
  );
  void pollLoop();
}

export async function stopEventSubscriber() {
  keepPolling = false;
  await redis.quit();
}
