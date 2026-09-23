import RedisModule from "ioredis";
import { InventoryRepository } from "../repositories/InventoryRepository.js";

const Redis = RedisModule.default ?? RedisModule;

const STREAM_NAME = "procurement.events";
const CONSUMER_GROUP = "inventory-service-group";
const CONSUMER_NAME = "inventory-worker-1";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const client = new Redis(redisUrl);
const inventoryRepo = new InventoryRepository();

let running = false;

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

  running = true;
  pollStream();
}

export function stopEventSubscriber() {
  running = false;
}

async function handlePurchaseOrderApproved(
  id: string,
  poId: string,
  sku: string,
  quantity: number,
  targetLocation: string,
) {
  const updated = await inventoryRepo.incrementOnOrder(
    sku,
    targetLocation,
    quantity,
  );

  if (updated) {
    console.log(
      `Processed PurchaseOrderApproved stream entry ${id} for PO ${poId}: SKU ${sku} at ${targetLocation} by +${quantity}`,
    );
    return;
  }

  console.log(
    `No inventory record for SKU ${sku} at ${targetLocation} — creating one (PO ${poId}).`,
  );
  await inventoryRepo.create({
    productName: sku, // placeholder; Inventory doesn't know the real name yet
    sku,
    locationId: targetLocation,
    quantityOnHand: 0,
  });
  await inventoryRepo.incrementOnOrder(sku, targetLocation, quantity);
  console.log(
    `Processed PurchaseOrderApproved stream entry ${id} for PO ${poId} after creating inventory row: SKU ${sku} at ${targetLocation} by +${quantity}`,
  );
}

async function pollStream() {
  while (running) {
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

              if (rawData === undefined) {
                console.error(
                  `Stream entry ${id} is missing a "data" field, skipping (poison message — acking to avoid infinite retry)`,
                );
                await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
                continue;
              }

              const parsedData = JSON.parse(rawData);
              const { id: poId, sku, quantity, locationId } = parsedData;
              const targetLocation = locationId || "MAIN_WAREHOUSE";

              await handlePurchaseOrderApproved(
                id,
                poId,
                sku,
                quantity,
                targetLocation,
              );

              await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
            } catch (innerErr) {
              console.error(
                `Error processing stream message entry ${id}, leaving unacked for retry:`,
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
