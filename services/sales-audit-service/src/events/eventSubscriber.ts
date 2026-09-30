import RedisModule from "ioredis";
import { SalesAuditService } from "../services/SalesAuditService.js";

const Redis = RedisModule.default ?? RedisModule;
const STREAM_NAME = "retail-sales.events";
const salesAuditService = new SalesAuditService();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);
let keepPolling = true;

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

async function ensureConsumerGroup() {
  try {
    await redis.xgroup(
      "CREATE",
      STREAM_NAME,
      "sales-audit-service-group",
      "$",
      "MKSTREAM",
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("BUSYGROUP")) {
      throw error;
    }
  }
}

async function handleItemSold(dataRaw: string, entryId: string) {
  const data = JSON.parse(dataRaw) as {
    registerId?: string;
    storeId?: string;
    total?: string | number;
  };

  if (!data.registerId || !data.storeId || data.total === undefined) {
    console.warn(
      `[${entryId}] ItemSold missing registerId/storeId/total, skipping`,
    );
    return;
  }

  await salesAuditService.recordSale({
    registerId: data.registerId,
    storeId: data.storeId,
    total: data.total,
  });

  console.log(
    `[${entryId}] ItemSold: added ${String(data.total)} to expected total for register ${data.registerId}`,
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

  if (streamName === STREAM_NAME && parsed.event === "ItemSold") {
    await handleItemSold(parsed.data, entryId);
  }
}

export async function startEventSubscriber() {
  await ensureConsumerGroup();
  void pollLoop();
}

async function pollLoop() {
  while (keepPolling) {
    try {
      const response = await redis.xreadgroup(
        "GROUP",
        "sales-audit-service-group",
        "sales-audit-worker-1",
        "COUNT",
        10,
        "BLOCK",
        5000,
        "STREAMS",
        STREAM_NAME,
        ">",
      );

      if (Array.isArray(response)) {
        const streams = response as [string, [string, string[]][]][];
        for (const [streamName, entries] of streams) {
          for (const [entryId, fields] of entries) {
            try {
              await processEntry(streamName, entryId, fields);
              await redis.xack(
                STREAM_NAME,
                "sales-audit-service-group",
                entryId,
              );
            } catch (processingError) {
              console.error(
                `Failed to process ${streamName} entry ${entryId}, leaving unacknowledged for retry:`,
                processingError,
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Sales audit event subscriber error:", error);
    }
  }
}

export function stopEventSubscriber() {
  keepPolling = false;
  void redis.quit();
}
