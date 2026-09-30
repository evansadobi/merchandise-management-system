import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { retailSalesTransactions } from "../db/schema.js";

export class RetailSalesRepository {
  async createSale(data: {
    saleId: string;
    storeId: string;
    registerId: string;
    customerId: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    totalAmount: string;
    paymentMethod: string;
    status?: string;
  }) {
    const [record] = await db
      .insert(retailSalesTransactions)
      .values(data)
      .returning();
    return record ?? null;
  }

  async findBySaleId(saleId: string) {
    return await db
      .select()
      .from(retailSalesTransactions)
      .where(eq(retailSalesTransactions.saleId, saleId));
  }

  async list(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return await db
      .select()
      .from(retailSalesTransactions)
      .limit(limit)
      .offset(offset);
  }
}
