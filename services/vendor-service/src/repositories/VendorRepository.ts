import { db } from "../db/db.js";
import { vendors } from "../db/schema.js";
import { eq } from "drizzle-orm";

export class VendorRepository {
  async findAll() {
    return await db.select().from(vendors);
  }

  async findById(id: string) {
    const result = await db.select().from(vendors).where(eq(vendors.id, id));
    return result[0] || null;
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
      status: "PENDING" | "APPROVED" | "SUSPENDED" | "ARCHIVED";
    }>,
  ) {
    const result = await db
      .update(vendors)
      .set(data)
      .where(eq(vendors.id, id))
      .returning();
    return result[0] || null;
  }
}
