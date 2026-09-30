import RedisModule from "ioredis";

const Redis = RedisModule.default ?? RedisModule;
const STREAM_NAME = "sales-audit.events";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);
let keepPolling = true;

async function ensureConsumerGroup() {
  try {
    await redis.xgroup(
      "CREATE",
      STREAM_NAME,
      "retail-sales-service-group",
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

export async function startEventSubscriber() {
  await ensureConsumerGroup();
  void pollLoop();
}

async function pollLoop() {
  while (keepPolling) {
    try {
      const response = await redis.xreadgroup(
        "GROUP",
        "retail-sales-service-group",
        "retail-sales-worker-1",
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
        for (const [, entries] of streams) {
          for (const [entryId] of entries) {
            await redis.xack(
              STREAM_NAME,
              "retail-sales-service-group",
              entryId,
            );
          }
        }
      }
    } catch (error) {
      console.error("Retail sales event subscriber error:", error);
    }
  }
}

export function stopEventSubscriber() {
  keepPolling = false;
  void redis.quit();
}
