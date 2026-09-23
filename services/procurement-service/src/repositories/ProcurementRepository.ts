import { eq, and, sql } from "drizzle-orm";
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
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.status, "DRAFT")))
      .returning();

    return result[0] || null;
  }

  async recordReceipt(id: string, quantityReceivedNow: number) {
    const result = await db
      .update(purchaseOrders)
      .set({
        quantityReceived: sql`${purchaseOrders.quantityReceived} + ${quantityReceivedNow}`,
        status: sql`(CASE
          WHEN ${purchaseOrders.quantityReceived} + ${quantityReceivedNow} >= ${purchaseOrders.quantityOrdered}
          THEN 'RECEIVED'
          ELSE 'PARTIALLY_RECEIVED'
        END)::purchase_order_status`,
      })
      .where(
        and(
          eq(purchaseOrders.id, id),
          sql`${purchaseOrders.status} IN ('APPROVED', 'PARTIALLY_RECEIVED')`,
          sql`${purchaseOrders.quantityReceived} + ${quantityReceivedNow} <= ${purchaseOrders.quantityOrdered}`,
        ),
      )
      .returning();

    return result[0] || null;
  }
}
