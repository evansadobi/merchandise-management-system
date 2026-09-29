import { eq, and, sql, inArray } from "drizzle-orm";
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

  async createExpectedDelivery(data: NewExpectedDelivery): Promise<void> {
    await db
      .insert(expectedDeliveries)
      .values(data)
      .onConflictDoNothing({
        target: [expectedDeliveries.purchaseOrderId, expectedDeliveries.sku],
      });
  }

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

      if (!grn) {
        throw new Error("Failed to insert Goods Received Note header");
      }

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

  /**
   * Fetch a page of GRNs WITH their line items hydrated.
   * Uses two queries total — one for the GRN headers, one for all
   * items across those headers — rather than N+1 per-GRN queries.
   */
  async findGrnsWithItems(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const grnRows = await db
      .select()
      .from(goodsReceivedNotes)
      .limit(limit)
      .offset(offset);

    if (grnRows.length === 0) {
      return [];
    }

    const grnIds = grnRows.map((g) => g.id);

    const itemRows = await db
      .select()
      .from(receivingItems)
      .where(inArray(receivingItems.grnId, grnIds));

    // Group items by their parent GRN id
    const itemsByGrn = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const list = itemsByGrn.get(item.grnId) ?? [];
      list.push(item);
      itemsByGrn.set(item.grnId, list);
    }

    return grnRows.map((grn) => ({
      ...grn,
      items: itemsByGrn.get(grn.id) ?? [],
    }));
  }

  async countGrns() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceivedNotes);
    return Number(result[0]?.count ?? 0);
  }
}
