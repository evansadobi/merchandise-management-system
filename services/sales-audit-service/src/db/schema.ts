import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";

export const registerReconciliations = pgTable("register_reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  registerId: varchar("register_id", { length: 100 }).notNull(),
  storeId: varchar("store_id", { length: 100 }).notNull(),
  expectedTotal: decimal("expected_total", {
    precision: 10,
    scale: 2,
  }).notNull(),
  physicalTotal: decimal("physical_total", {
    precision: 10,
    scale: 2,
  }).notNull(),
  variance: decimal("variance", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("OPEN"),
  managerName: varchar("manager_name", { length: 150 }),
  explanation: varchar("explanation", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const salesAuditSchema = {
  registerReconciliations,
};
