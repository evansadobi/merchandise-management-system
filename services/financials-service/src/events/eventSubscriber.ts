import RedisModule from "ioredis";
import { FinancialsService } from "../services/FinancialsService.js";

const Redis = RedisModule.default ?? RedisModule;
const RETAIL_SALES_STREAM = "retail-sales.events";
const SALES_AUDIT_STREAM = "sales-audit.events";
const CONSUMER_GROUP = "financials-service-group";
const CONSUMER_NAME = "financials-worker-1";
const financialsService = new FinancialsService();

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

async function ensureConsumerGroup(streamName: string) {
  try {
    await redis.xgroup("CREATE", streamName, CONSUMER_GROUP, "$", "MKSTREAM");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("BUSYGROUP")) {
      throw error;
    }
  }
}

async function handleItemSold(dataRaw: string, entryId: string) {
  const data = JSON.parse(dataRaw) as {
    total?: string | number;
    registerId?: string;
  };

  if (data.total === undefined) {
    console.warn(`[${entryId}] ItemSold missing total, skipping`);
    return;
  }

  await financialsService.ensureLedger(
    "SALES_REVENUE",
    "Sales Revenue",
    "REVENUE",
  );
  await financialsService.createLedgerEntry({
    ledgerId: "SALES_REVENUE",
    entryType: "CREDIT",
    amount: String(data.total),
    currency: "KES",
    description: `Retail sale posted at register ${data.registerId ?? "unknown"}`,
    referenceType: "ItemSold",
    referenceId: data.registerId ?? null,
  });

  console.log(
    `[${entryId}] ItemSold: credited SALES_REVENUE ${String(data.total)} KES`,
  );
}

async function handleDayClosed(dataRaw: string, entryId: string) {
  const data = JSON.parse(dataRaw) as {
    variance?: string | number;
    registerId?: string;
  };

  if (data.variance === undefined) {
    console.warn(`[${entryId}] DayClosed missing variance, skipping`);
    return;
  }

  const variance = Number(data.variance);
  const ledgerId = variance >= 0 ? "CASH" : "SHORTAGE_ACCOUNT";

  await financialsService.ensureLedger(
    ledgerId,
    variance >= 0 ? "Cash" : "Shortage Account",
    variance >= 0 ? "ASSET" : "EXPENSE",
  );

  await financialsService.createLedgerEntry({
    ledgerId,
    entryType: variance >= 0 ? "DEBIT" : "CREDIT",
    amount: Math.abs(variance).toFixed(2),
    currency: "KES",
    description: `Register close variance for ${data.registerId ?? "unknown"}`,
    referenceType: "DayClosed",
    referenceId: data.registerId ?? null,
  });

  console.log(
    `[${entryId}] DayClosed: ${variance >= 0 ? "debited" : "credited"} ${ledgerId} by ${Math.abs(variance).toFixed(2)}`,
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

  if (streamName === RETAIL_SALES_STREAM && parsed.event === "ItemSold") {
    await handleItemSold(parsed.data, entryId);
    return;
  }

  if (streamName === SALES_AUDIT_STREAM && parsed.event === "DayClosed") {
    await handleDayClosed(parsed.data, entryId);
  }
}

export async function startEventSubscriber() {
  await ensureConsumerGroup(RETAIL_SALES_STREAM);
  await ensureConsumerGroup(SALES_AUDIT_STREAM);
  void pollLoop();
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
        RETAIL_SALES_STREAM,
        SALES_AUDIT_STREAM,
        ">",
        ">",
      );

      if (Array.isArray(response)) {
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
      }
    } catch (error) {
      console.error("Financials event subscriber error:", error);
    }
  }
}

export function stopEventSubscriber() {
  keepPolling = false;
  void redis.quit();
}
