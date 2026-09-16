import { eq, sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { purchaseOrders } from "../db/schema.js";

export class ProcurementRepository {
  async findAll() {
    return await db.select().from(purchaseOrders);
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));

    return result[0] || null;
  }

  async create(data: {
    vendorId: string;
    sku: string;
    quantityOrdered: number;
    unitCost: string;
    paymentTerms: string;
  }) {
    const result = await db.insert(purchaseOrders).values(data).returning();
    return result[0];
  }

  async approve(id: string, approvedBy: string) {
    const result = await db
      .update(purchaseOrders)
      .set({ status: "APPROVED", approvedBy, approvedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();

    return result[0] || null;
  }

  async recordReceipt(id: string, quantityReceivedNow: number) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const newQuantityReceived = existing.quantityReceived + quantityReceivedNow;
    const isFullyReceived = newQuantityReceived >= existing.quantityOrdered;

    const result = await db
      .update(purchaseOrders)
      .set({
        quantityReceived: sql`${purchaseOrders.quantityReceived} + ${quantityReceivedNow}`,
        status: isFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED",
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    return result[0] || null;
  }
}
