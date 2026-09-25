import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  goodsReceivedNotes,
  receivingItems,
  expectedDeliveries,
} from "../db/schema.js";
import type {
  ExpectedDelivery,
  NewExpectedDelivery,
  NewGoodsReceivedNote,
  NewReceivingItem,
} from "../types.js";

export class ReceivingRepository {
  async findExpectedDelivery(
    purchaseOrderId: string,
    sku: string,
  ): Promise<ExpectedDelivery | undefined> {
    const records = await db
      .select()
      .from(expectedDeliveries)
      .where(
        and(
          eq(expectedDeliveries.purchaseOrderId, purchaseOrderId),
          eq(expectedDeliveries.sku, sku),
        ),
      )
      .limit(1);

    return records[0];
  }

  async findAllExpectedDeliveries() {
    return await db.select().from(expectedDeliveries);
  }

  /**
   * Idempotent via ON CONFLICT DO NOTHING on (purchaseOrderId, sku) — safe
   * to call again if a PurchaseOrderApproved event is redelivered after a
   * prior attempt didn't get far enough to ack.
   */
  async createExpectedDelivery(data: NewExpectedDelivery): Promise<void> {
    await db
      .insert(expectedDeliveries)
      .values(data)
      .onConflictDoNothing({
        target: [expectedDeliveries.purchaseOrderId, expectedDeliveries.sku],
      });
  }

  /**
   * Creates the GRN header, its line items, and updates each referenced
   * expectedDeliveries row's progress — all in one transaction, so a GRN
   * is never recorded without its corresponding expected-delivery update
   * (or vice versa) surviving a partial failure.
   *
   * isFullyReceived is NOT accepted from the caller — it's computed here,
   * atomically, against the live DB row's current quantityReceivedSoFar,
   * cast explicitly to the enum type (same fix pattern used in
   * procurement-service and inventory-service for this exact class of
   * "column is of type X but expression is of type text" error).
   */
  async createGrnWithItems(
    grnData: NewGoodsReceivedNote,
    itemsData: Array<Omit<NewReceivingItem, "grnId">>,
    expectedUpdates: Array<{ id: string; additionalReceived: number }>,
  ) {
    return await db.transaction(async (tx) => {
      const [grn] = await tx
        .insert(goodsReceivedNotes)
        .values(grnData)
        .returning();

      const itemsToInsert = itemsData.map((item) => ({
        ...item,
        grnId: grn.id,
      }));
      const insertedItems = await tx
        .insert(receivingItems)
        .values(itemsToInsert)
        .returning();

      for (const update of expectedUpdates) {
        await tx
          .update(expectedDeliveries)
          .set({
            quantityReceivedSoFar: sql`${expectedDeliveries.quantityReceivedSoFar} + ${update.additionalReceived}`,
            status: sql`(CASE
              WHEN ${expectedDeliveries.quantityReceivedSoFar} + ${update.additionalReceived} >= ${expectedDeliveries.quantityExpected}
              THEN 'FULLY_RECEIVED'
              ELSE 'PARTIALLY_RECEIVED'
            END)::expected_delivery_status`,
          })
          .where(eq(expectedDeliveries.id, update.id));
      }

      return { grn, items: insertedItems };
    });
  }

  async findGrnById(grnId: string) {
    const result = await db
      .select()
      .from(goodsReceivedNotes)
      .where(eq(goodsReceivedNotes.id, grnId));

    if (!result[0]) return null;

    const items = await db
      .select()
      .from(receivingItems)
      .where(eq(receivingItems.grnId, grnId));

    return { grn: result[0], items };
  }

  async findAllGrns(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(goodsReceivedNotes)
      .limit(limit)
      .offset(offset);
  }

  async countGrns() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceivedNotes);
    return Number(result[0]?.count ?? 0);
  }
}
