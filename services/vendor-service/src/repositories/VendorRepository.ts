import { db } from "../db/db.js";
import { vendors } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import type { VendorStatus } from "../types.js";

const MAX_LIMIT = 100;

export class VendorRepository {
  async findAll(page = 1, limit = 20) {
    const safePage = Number.isInteger(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : 20;
    const offset = (safePage - 1) * safeLimit;

    return await db.select().from(vendors).limit(safeLimit).offset(offset);
  }

  async count() {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(vendors);
    return Number(result[0]?.count ?? 0);
  }

  async findById(id: string) {
    const result = await db.select().from(vendors).where(eq(vendors.id, id));
    return result[0] ?? null;
  }

  async create(data: {
    name: string;
    contactEmail: string;
    contactPhone: string;
    paymentTerms: string;
    leadTimeDays: number;
  }) {
    const result = await db.insert(vendors).values(data).returning();
    return result[0];
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      contactEmail: string;
      contactPhone: string;
      paymentTerms: string;
      leadTimeDays: number;
      status: VendorStatus;
    }>,
  ) {
    const result = await db
      .update(vendors)
      .set(data)
      .where(eq(vendors.id, id))
      .returning();

    return result[0] ?? null;
  }

  async delete(id: string) {
    const result = await db
      .delete(vendors)
      .where(eq(vendors.id, id))
      .returning();
    return result[0] ?? null;
  }
}
