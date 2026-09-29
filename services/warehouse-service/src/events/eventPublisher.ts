import RedisModule from "ioredis";
const Redis = RedisModule.default ?? RedisModule;

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const redis = new Redis(redisUrl);

const RECEIVING_STREAM = "receiving.events";
const WAREHOUSE_STREAM = "warehouse.events";

async function publish(stream: string, event: string, data: object) {
  await redis.xadd(
    stream,
    "*",
    "event",
    event,
    "timestamp",
    new Date().toISOString(),
    "data",
    JSON.stringify(data),
  );
}

export async function publishPutawayTaskCreated(data: {
  taskId: string;
  sku: string;
  quantity: number;
  suggestedBinCode: string | null;
}) {
  await publish(WAREHOUSE_STREAM, "PutawayTaskCreated", data);
}

export async function publishStockPlaced(data: {
  sku: string;
  warehouseId: string;
  binCode: string;
  quantity: number;
}) {
  await publish(WAREHOUSE_STREAM, "StockPlaced", data);
}

export async function stopEventPublisher() {
  await redis.quit();
}
