import { eq, and } from "drizzle-orm";
import { db } from "../db/db.js";
import { vendorProducts, vendors } from "../db/schema.js";
import { VendorStatus } from "../types.js";

export class VendorProductRepository {
  async findByVendorId(vendorId: string) {
    return await db
      .select()
      .from(vendorProducts)
      .where(eq(vendorProducts.vendorId, vendorId));
  }

  async findById(id: string) {
    const result = await db
      .select()
      .from(vendorProducts)
      .where(eq(vendorProducts.id, id));

    return result[0] ?? null;
  }

  async findSuppliersBySkuAndStatus(sku: string, status?: VendorStatus) {
    const conditions = [
      eq(vendorProducts.sku, sku),
      eq(vendors.status, status ?? VendorStatus.APPROVED),
    ];

    return await db
      .select({
        vendorId: vendors.id,
        vendorName: vendors.name,
        paymentTerms: vendors.paymentTerms,
        leadTimeDays: vendors.leadTimeDays,
        unitCost: vendorProducts.unitCost,
      })
      .from(vendorProducts)
      .innerJoin(vendors, eq(vendorProducts.vendorId, vendors.id))
      .where(and(...conditions));
  }

  async create(data: { vendorId: string; sku: string; unitCost: string }) {
    const result = await db.insert(vendorProducts).values(data).returning();
    return result[0];
  }

  async update(
    id: string,
    updates: Partial<{ sku: string; unitCost: string }>,
  ) {
    const result = await db
      .update(vendorProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(vendorProducts.id, id))
      .returning();

    return result[0] ?? null;
  }

  async delete(id: string) {
    const result = await db
      .delete(vendorProducts)
      .where(eq(vendorProducts.id, id))
      .returning();

    return result[0] ?? null;
  }
}
