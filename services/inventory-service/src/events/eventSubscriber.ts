import RedisModule from "ioredis";
import { InventoryRepository } from "../repositories/InventoryRepository.js";

const Redis = RedisModule.default ?? RedisModule;

const STREAM_NAME = "procurement.events";
const CONSUMER_GROUP = "inventory-service-group";
const CONSUMER_NAME = "inventory-worker-1";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const client = new Redis(redisUrl);
const inventoryRepo = new InventoryRepository();

async function ensureConsumerGroup() {
  try {
    await client.xgroup("CREATE", STREAM_NAME, CONSUMER_GROUP, "$", "MKSTREAM");
  } catch (err: any) {
    if (!err.message?.includes("BUSYGROUP")) {
      console.error("Error creating consumer group:", err);
    }
  }
}

export async function startEventSubscriber() {
  await ensureConsumerGroup();
  console.log(
    `Inventory service listening to stream ${STREAM_NAME} via consumer group ${CONSUMER_GROUP}`,
  );

  pollStream();
}

async function pollStream() {
  while (true) {
    try {
      const results = (await client.xreadgroup(
        "GROUP",
        CONSUMER_GROUP,
        CONSUMER_NAME,
        "BLOCK",
        5000,
        "STREAMS",
        STREAM_NAME,
        ">",
      )) as [string, [string, string[]][]][] | null;

      if (results) {
        for (const [, streams] of results) {
          for (const [id, fields] of streams) {
            try {
              const dataIndex = fields.indexOf("data");
              const rawData =
                dataIndex !== -1 ? fields[dataIndex + 1] : undefined;

              if (rawData !== undefined) {
                const parsedData = JSON.parse(rawData);
                const { id: poId, sku, quantity, locationId } = parsedData;
                const targetLocation = locationId || "MAIN_WAREHOUSE";

                await inventoryRepo.incrementOnOrder(
                  sku,
                  targetLocation,
                  quantity,
                );
                console.log(
                  `Processed PurchaseOrderApproved stream entry ${id} for PO ${poId}: SKU ${sku} at ${targetLocation} by +${quantity}`,
                );
              } else {
                console.error(
                  `Stream entry ${id} is missing a "data" field, skipping`,
                );
              }

              await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
            } catch (innerErr) {
              console.error(
                `Error processing stream message entry ${id}:`,
                innerErr,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Error reading from Redis stream:", err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
