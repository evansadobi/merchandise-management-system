import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "DRAFT",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),

  vendorId: uuid("vendor_id").notNull(),

  sku: varchar("sku", { length: 100 }).notNull(),

  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0).notNull(),

  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  paymentTerms: varchar("payment_terms", { length: 100 }).notNull(),

  status: purchaseOrderStatusEnum("status").default("DRAFT").notNull(),

  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
