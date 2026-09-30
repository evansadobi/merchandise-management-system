import { eq, and, sql, lte } from "drizzle-orm";
import { db } from "../db/db.js";
import { inventoryItems, inventoryReservations } from "../db/schema.js";
import { BadRequestError, NotFoundError } from "../types.js";

export class InventoryRepository {
  async findAll(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return await db.select().from(inventoryItems).limit(limit).offset(offset);
  }

  async count() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryItems);
    return Number(result[0]?.count ?? 0);
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id));
    return result[0] ?? null;
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
    return result[0] ?? null;
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
          sql`${inventoryItems.quantityOnHand} + ${delta} >= 0`,
        ),
      )
      .returning();
    return result[0] ?? null;
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
          sql`${inventoryItems.quantityAllocated} + ${quantity} <= ${inventoryItems.quantityOnHand}`,
        ),
      )
      .returning();
    return result[0] ?? null;
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
    return result[0] ?? null;
  }

  async commitSale(sku: string, locationId: string, quantity: number) {
    const result = await db
      .update(inventoryItems)
      .set({
        quantityOnHand: sql`${inventoryItems.quantityOnHand} - ${quantity}`,
        quantityAllocated: sql`GREATEST(${inventoryItems.quantityAllocated} - ${quantity}, 0)`,
      })
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
          sql`${inventoryItems.quantityOnHand} - ${quantity} >= 0`,
        ),
      )
      .returning();
    return result[0] ?? null;
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
    return result[0] ?? null;
  }

  async receiveOnOrderStock(sku: string, locationId: string, quantity: number) {
    const result = await db
      .insert(inventoryItems)
      .values({
        productName: sku,
        sku,
        locationId,
        quantityOnHand: quantity,
        quantityOnOrder: 0,
        unitValue: "0",
        reorderLevel: 10,
      })
      .onConflictDoUpdate({
        target: [inventoryItems.sku, inventoryItems.locationId],
        set: {
          quantityOnHand: sql`${inventoryItems.quantityOnHand} + ${quantity}`,
          quantityOnOrder: sql`GREATEST(${inventoryItems.quantityOnOrder} - ${quantity}, 0)`,
        },
      })
      .returning();

    return result[0] ?? null;
  }

  async updateAttributes(
    sku: string,
    locationId: string,
    data: {
      weightKg?: string;
      volumeCm3?: number;
      salesVelocity?: "HIGH" | "MEDIUM" | "LOW";
    },
  ) {
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length === 0) {
      return null;
    }

    const result = await db
      .update(inventoryItems)
      .set(updateData)
      .where(
        and(
          eq(inventoryItems.sku, sku),
          eq(inventoryItems.locationId, locationId),
        ),
      )
      .returning();

    return result[0] ?? null;
  }

  async transferStock(
    sku: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
  ) {
    if (fromLocationId === toLocationId) {
      throw new BadRequestError("fromLocationId and toLocationId must differ");
    }
    if (quantity <= 0) {
      throw new BadRequestError("quantity must be positive");
    }

    return await db.transaction(async (tx) => {
      const sourceRows = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.sku, sku),
            eq(inventoryItems.locationId, fromLocationId),
          ),
        );

      const source = sourceRows[0];
      if (!source) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} at location ${fromLocationId} not found.`,
        );
      }

      const available =
        Number(source.quantityOnHand) - Number(source.quantityAllocated);
      if (quantity > available) {
        throw new BadRequestError(
          `Insufficient On Hand for SKU ${sku} at location ${fromLocationId} (available: ${available}).`,
        );
      }

      const updatedSource = await tx
        .update(inventoryItems)
        .set({
          quantityOnHand: sql`${inventoryItems.quantityOnHand} - ${quantity}`,
        })
        .where(
          and(
            eq(inventoryItems.sku, sku),
            eq(inventoryItems.locationId, fromLocationId),
          ),
        )
        .returning();

      const sourceAfter = updatedSource[0];
      if (!sourceAfter) {
        throw new NotFoundError(
          `Inventory item for SKU ${sku} at location ${fromLocationId} not found.`,
        );
      }

      const destinationRows = await tx
        .insert(inventoryItems)
        .values({
          productName: source.productName,
          sku,
          locationId: toLocationId,
          quantityOnHand: quantity,
          unitValue: source.unitValue,
          reorderLevel: source.reorderLevel,
        })
        .onConflictDoUpdate({
          target: [inventoryItems.sku, inventoryItems.locationId],
          set: {
            quantityOnHand: sql`${inventoryItems.quantityOnHand} + ${quantity}`,
          },
        })
        .returning();

      const destination = destinationRows[0];
      if (!destination) {
        throw new Error("Destination upsert returned no row");
      }

      return { source: sourceAfter, destination };
    });
  }

  async delete(id: string) {
    const result = await db
      .delete(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .returning();
    return result[0] ?? null;
  }

  async findStockLevel(sku: string, locationId: string) {
    return await this.findBySkuAndLocation(sku, locationId);
  }

  async reserveForSale(
    saleId: string,
    sku: string,
    locationId: string,
    quantity: number,
  ) {
    return await db.transaction(async (tx) => {
      const existingReservation = await tx
        .select()
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.saleId, saleId),
            eq(inventoryReservations.sku, sku),
            eq(inventoryReservations.locationId, locationId),
            eq(inventoryReservations.status, "RESERVED"),
          ),
        );

      if (existingReservation[0]) {
        const level = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.sku, sku),
              eq(inventoryItems.locationId, locationId),
            ),
          );

        return {
          kind: "already_reserved" as const,
          level: level[0] ?? null,
        };
      }

      const result = await tx
        .update(inventoryItems)
        .set({
          quantityAllocated: sql`${inventoryItems.quantityAllocated} + ${quantity}`,
        })
        .where(
          and(
            eq(inventoryItems.sku, sku),
            eq(inventoryItems.locationId, locationId),
            sql`${inventoryItems.quantityAllocated} + ${quantity} <= ${inventoryItems.quantityOnHand}`,
          ),
        )
        .returning();

      const level = result[0];

      if (!level) {
        return {
          kind: "insufficient" as const,
          level: null,
        };
      }

      await tx.insert(inventoryReservations).values({
        saleId,
        sku,
        locationId,
        quantity,
        status: "RESERVED",
      });

      return {
        kind: "reserved" as const,
        level,
      };
    });
  }

  async releaseForSale(saleId: string, sku: string, locationId: string) {
    return await db.transaction(async (tx) => {
      const reservations = await tx
        .select()
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.saleId, saleId),
            eq(inventoryReservations.sku, sku),
            eq(inventoryReservations.locationId, locationId),
            eq(inventoryReservations.status, "RESERVED"),
          ),
        );

      const reservation = reservations[0];

      if (!reservation) {
        return {
          kind: "no_reservation" as const,
          level: null,
        };
      }

      await tx
        .update(inventoryReservations)
        .set({
          status: "RELEASED",
          updatedAt: new Date(),
        })
        .where(eq(inventoryReservations.id, reservation.id));

      const result = await tx
        .update(inventoryItems)
        .set({
          quantityAllocated: sql`GREATEST(${inventoryItems.quantityAllocated} - ${reservation.quantity}, 0)`,
        })
        .where(
          and(
            eq(inventoryItems.sku, sku),
            eq(inventoryItems.locationId, locationId),
          ),
        )
        .returning();

      return {
        kind: "released" as const,
        level: result[0] ?? null,
      };
    });
  }

  async commitForSale(
    saleId: string,
    sku: string,
    locationId: string,
    quantity: number,
  ) {
    return await db.transaction(async (tx) => {
      const reservations = await tx
        .select()
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.saleId, saleId),
            eq(inventoryReservations.sku, sku),
            eq(inventoryReservations.locationId, locationId),
            eq(inventoryReservations.status, "RESERVED"),
          ),
        );

      const reservation = reservations[0];

      if (!reservation) {
        return {
          kind: "no_reservation" as const,
          level: null,
          reserved: null,
        };
      }

      if (reservation.quantity !== quantity) {
        return {
          kind: "quantity_mismatch" as const,
          level: null,
          reserved: reservation.quantity,
        };
      }

      await tx
        .update(inventoryReservations)
        .set({
          status: "COMMITTED",
          updatedAt: new Date(),
        })
        .where(eq(inventoryReservations.id, reservation.id));

      const result = await tx
        .update(inventoryItems)
        .set({
          quantityOnHand: sql`${inventoryItems.quantityOnHand} - ${quantity}`,
          quantityAllocated: sql`GREATEST(${inventoryItems.quantityAllocated} - ${quantity}, 0)`,
        })
        .where(
          and(
            eq(inventoryItems.sku, sku),
            eq(inventoryItems.locationId, locationId),
            sql`${inventoryItems.quantityOnHand} - ${quantity} >= 0`,
          ),
        )
        .returning();

      if (!result[0]) {
        return {
          kind: "insufficient_on_hand" as const,
          level: null,
          reserved: null,
        };
      }

      return {
        kind: "committed" as const,
        level: result[0],
        reserved: null,
      };
    });
  }
}
