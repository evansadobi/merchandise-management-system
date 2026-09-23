import RedisModule from "ioredis";

const Redis = RedisModule.default ?? RedisModule;

const STREAM_NAME = "inventory.events";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);

redis.on("error", (err: unknown) => {
  console.error("Redis publisher connection error:", err);
});

export async function publishStockLow(item: {
  sku: string;
  locationId: string;
  quantityOnHand: number;
  reorderLevel: number;
}) {
  const payload = {
    event: "StockLow",
    timestamp: new Date().toISOString(),
    data: JSON.stringify(item),
  };

  try {
    const entryId = await redis.xadd(
      STREAM_NAME,
      "*",
      "event",
      payload.event,
      "timestamp",
      payload.timestamp,
      "data",
      payload.data,
    );

    console.log(
      `Published StockLow event for SKU ${item.sku} at ${item.locationId} (stream entry ${entryId})`,
    );
  } catch (error) {
    console.error(
      `Failed to publish StockLow event for SKU ${item.sku}:`,
      error,
    );
  }
}

export async function stopEventPublisher() {
  await redis.quit();
}
