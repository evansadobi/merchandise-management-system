import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";

export const financialLedgers = pgTable("financial_ledgers", {
  id: uuid("id").defaultRandom().primaryKey(),
  ledgerId: varchar("ledger_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 60 }).notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("KES"),
  balance: decimal("balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const financialLedgerEntries = pgTable("financial_ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  ledgerId: varchar("ledger_id", { length: 100 }).notNull(),
  entryType: varchar("entry_type", { length: 20 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 20 }).notNull().default("KES"),
  description: varchar("description", { length: 255 }).notNull(),
  referenceType: varchar("reference_type", { length: 60 }),
  referenceId: varchar("reference_id", { length: 150 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const financialsSchema = {
  financialLedgers,
  financialLedgerEntries,
};
