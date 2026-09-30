import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { registerReconciliations } from "../db/schema.js";

function toDecimalString(value: number | string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
}

export class SalesAuditRepository {
  async createReconciliation(data: {
    registerId: string;
    storeId: string;
    expectedTotal: string;
    physicalTotal: string;
    variance: string;
    status?: string;
    managerName?: string | null;
    explanation?: string | null;
  }) {
    const [record] = await db
      .insert(registerReconciliations)
      .values(data)
      .returning();
    return record ?? null;
  }

  async upsertReconciliation(data: {
    registerId: string;
    storeId: string;
    expectedTotal: string;
    physicalTotal: string;
    variance: string;
    status?: string;
    managerName?: string | null;
    explanation?: string | null;
  }) {
    const existing = await this.findByRegisterId(data.registerId);
    const current = existing[0];

    const nextData = {
      ...data,
      expectedTotal: toDecimalString(data.expectedTotal),
      physicalTotal: toDecimalString(data.physicalTotal),
      variance: toDecimalString(data.variance),
      status: data.status ?? current?.status ?? "OPEN",
      managerName: data.managerName ?? current?.managerName ?? null,
      explanation: data.explanation ?? current?.explanation ?? null,
    };

    if (!current) {
      return await this.createReconciliation(nextData);
    }

    const [updated] = await db
      .update(registerReconciliations)
      .set(nextData)
      .where(eq(registerReconciliations.id, current.id))
      .returning();

    return updated ?? current;
  }

  async findByRegisterId(registerId: string) {
    return await db
      .select()
      .from(registerReconciliations)
      .where(eq(registerReconciliations.registerId, registerId));
  }

  async list() {
    return await db.select().from(registerReconciliations);
  }
}
