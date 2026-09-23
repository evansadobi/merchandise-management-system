import RedisModule from "ioredis";

const Redis = RedisModule.default ?? RedisModule;

const STREAM_NAME = "procurement.events";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const redis = new Redis(redisUrl);

redis.on("error", (err: unknown) => {
  console.error("Redis publisher connection error:", err);
});

export async function publishPurchaseOrderApproved(po: {
  id: string;
  sku: string;
  quantity: number;
  locationId?: string;
}) {
  const payload = {
    event: "PurchaseOrderApproved",
    timestamp: new Date().toISOString(),
    data: JSON.stringify(po),
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
      `Published PurchaseOrderApproved event for PO ${po.id} (stream entry ${entryId})`,
    );
  } catch (error) {
    console.error(
      `Failed to publish PurchaseOrderApproved event for PO ${po.id}:`,
      error,
    );
  }
}

export async function stopEventPublisher() {
  await redis.quit();
}
