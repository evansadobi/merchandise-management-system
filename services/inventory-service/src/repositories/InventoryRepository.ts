import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../db/db.js";
import { inventoryItems } from "../db/schema.js";

export class InventoryRepository {
  async findAll() {
    return await db.select().from(inventoryItems);
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id));

    return result[0] || null;
  }

  async findBySku(sku: string) {
    return await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.sku, sku));
  }

  async findBySkuAndLocation(sku: string, locationId: string) {
    const result = await db
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      );

    return result[0] || null;
  }

  async findLowStock() {
    return await db
      .select()
      .from(inventoryItems)
      .where(lte(inventoryItems.quantityOnHand, inventoryItems.reorderLevel));
  }

  async create(data: {
    productName: string;
    sku: string;
    locationId?: string | undefined;
    quantityOnHand?: number | undefined;
    unitValue?: string | undefined;
    reorderLevel?: number | undefined;
  }) {
    const insertData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as typeof data;

    const result = await db
      .insert(inventoryItems)
      .values(insertData)
      .returning();
    return result[0];
  }

  async adjustOnHand(sku: string, locationId: string, delta: number) {
    const result = await db
      .update(inventoryItems)
      .set({
        quantityOnHand: sql`${inventoryItems.quantityOnHand} + ${delta}`,
      })
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .returning();

    return result[0] || null;
  }

  async allocate(sku: string, locationId: string, quantity: number) {
    const result = await db
      .update(inventoryItems)
      .set({
        quantityAllocated: sql`${inventoryItems.quantityAllocated} + ${quantity}`,
      })
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .returning();

    return result[0] || null;
  }

  async releaseAllocation(sku: string, locationId: string, quantity: number) {
    const result = await db
      .update(inventoryItems)
      .set({
        quantityAllocated: sql`GREATEST(${inventoryItems.quantityAllocated} - ${quantity}, 0)`,
      })
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .returning();

    return result[0] || null;
  }

  async incrementOnOrder(sku: string, locationId: string, quantity: number) {
    const result = await db
      .update(inventoryItems)
      .set({
        quantityOnOrder: sql`${inventoryItems.quantityOnOrder} + ${quantity}`,
      })
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .returning();

    return result[0] || null;
  }
}
