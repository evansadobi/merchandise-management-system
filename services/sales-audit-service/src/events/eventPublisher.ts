import RedisModule from "ioredis";

const Redis = RedisModule.default ?? RedisModule;
const STREAM_NAME = "sales-audit.events";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);

redis.on("error", (err: unknown) => {
  console.error("Sales audit Redis publisher error:", err);
});

export async function publishDayClosed(payload: Record<string, unknown>) {
  const event = {
    event: "DayClosed",
    timestamp: new Date().toISOString(),
    data: JSON.stringify(payload),
  };

  await redis.xadd(
    STREAM_NAME,
    "*",
    "event",
    event.event,
    "timestamp",
    event.timestamp,
    "data",
    event.data,
  );
}

export async function stopEventPublisher() {
  await redis.quit();
}
