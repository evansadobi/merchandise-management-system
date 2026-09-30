import { eq, sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { financialLedgers, financialLedgerEntries } from "../db/schema.js";

export class FinancialsRepository {
  async listLedgers() {
    return await db.select().from(financialLedgers);
  }

  async getLedgerById(ledgerId: string) {
    return await db
      .select()
      .from(financialLedgers)
      .where(eq(financialLedgers.ledgerId, ledgerId));
  }

  async createLedger(data: {
    ledgerId: string;
    name: string;
    type: string;
    currency: string;
    balance?: string;
  }) {
    const [record] = await db
      .insert(financialLedgers)
      .values({
        ledgerId: data.ledgerId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance ?? "0.00",
      })
      .returning();

    return record ?? null;
  }

  async updateLedgerBalance(
    ledgerId: string,
    amount: string,
    entryType: "DEBIT" | "CREDIT",
  ) {
    const ledgerRows = await this.getLedgerById(ledgerId);
    const ledger = ledgerRows[0];
    if (!ledger) {
      return null;
    }

    const currentBalance = Number(ledger.balance ?? "0.00");
    const delta = Number(amount);
    const nextBalance =
      entryType === "DEBIT" ? currentBalance + delta : currentBalance - delta;

    const [updated] = await db
      .update(financialLedgers)
      .set({
        balance: nextBalance.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(financialLedgers.ledgerId, ledgerId))
      .returning();

    return updated ?? null;
  }

  async createLedgerEntry(data: {
    ledgerId: string;
    entryType: string;
    amount: string;
    currency: string;
    description: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    const [record] = await db
      .insert(financialLedgerEntries)
      .values({
        ledgerId: data.ledgerId,
        entryType: data.entryType,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
      })
      .returning();

    return record ?? null;
  }
}
