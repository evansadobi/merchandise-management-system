import RedisModule from "ioredis";
import { ReceivingRepository } from "../repositories/ReceivingRepository.js";

const Redis = RedisModule.default ?? RedisModule;

const STREAM_NAME = "procurement.events";
const CONSUMER_GROUP = "receiving-service-group";
const CONSUMER_NAME = "receiving-worker-1";
const CLAIM_IDLE_MS = 30000;
const CLAIM_INTERVAL_MS = 15000;

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const client = new Redis(redisUrl);
const receivingRepo = new ReceivingRepository();

let running = false;
let claimInterval: NodeJS.Timeout | null = null;

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
    `Receiving service listening to stream ${STREAM_NAME} via consumer group ${CONSUMER_GROUP}`,
  );
  running = true;
  pollStream();
  claimInterval = setInterval(processPendingMessages, CLAIM_INTERVAL_MS);
}

export function stopEventSubscriber() {
  running = false;
  if (claimInterval) {
    clearInterval(claimInterval);
    claimInterval = null;
  }
}

async function handlePurchaseOrderApproved(
  poId: string,
  sku: string,
  quantity: number,
  vendorId: string,
) {
  await receivingRepo.createExpectedDelivery({
    purchaseOrderId: poId,
    sku,
    supplierId: vendorId,
    quantityExpected: quantity,
  });
  console.log(
    `Recorded (or confirmed already recorded) expected delivery for PO ${poId}: SKU ${sku}, qty ${quantity}`,
  );
}

async function processPendingMessages() {
  try {
    const claimed = await client.xautoclaim(
      STREAM_NAME,
      CONSUMER_GROUP,
      CONSUMER_NAME,
      CLAIM_IDLE_MS,
      "0-0",
      "COUNT",
      10,
    );

    const entries = claimed?.[1] as [string, string[]][] | undefined;
    if (!entries || entries.length === 0) return;

    console.log(
      `Recovered ${entries.length} unacked pending message(s) from stream.`,
    );

    for (const [id, fields] of entries) {
      try {
        const dataIndex = fields.indexOf("data");
        const rawData = dataIndex !== -1 ? fields[dataIndex + 1] : undefined;

        if (rawData === undefined) {
          console.error(
            `Recovered entry ${id} missing "data" field — acking as poison message.`,
          );
          await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
          continue;
        }

        const parsed = JSON.parse(rawData);
        const { id: poId, sku, quantity, vendorId } = parsed;

        if (!vendorId) {
          console.error(
            `Recovered entry ${id} (PO ${poId}) has no vendorId — acking as poison message.`,
          );
          await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
          continue;
        }

        await handlePurchaseOrderApproved(poId, sku, quantity, vendorId);
        await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
      } catch (innerErr) {
        console.error(
          `Error reprocessing recovered entry ${id}, leaving unacked for next claim attempt:`,
          innerErr,
        );
      }
    }
  } catch (err) {
    console.error("Error recovering pending messages:", err);
  }
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
                  `Stream entry ${id} missing "data" field — acking as poison message.`,
                );
                await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
                continue;
              }

              const parsed = JSON.parse(rawData);
              const { id: poId, sku, quantity, vendorId } = parsed;

              if (!vendorId) {
                console.error(
                  `Stream entry ${id} (PO ${poId}) has no vendorId — cannot record expected delivery. Acking as poison message.`,
                );
                await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
                continue;
              }

              await handlePurchaseOrderApproved(poId, sku, quantity, vendorId);
              await client.xack(STREAM_NAME, CONSUMER_GROUP, id);
            } catch (innerErr) {
              console.error(
                `Error processing stream entry ${id}, leaving unacked for retry:`,
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
