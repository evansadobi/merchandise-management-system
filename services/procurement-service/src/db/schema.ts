import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
} from "drizzle-orm/pg-core";

// DRAFT -> APPROVED -> PARTIALLY_RECEIVED -> RECEIVED (closed)
// Sequential only — enforced in the controller, not just documented here.
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

  // Split so partially-received POs can be represented and queried.
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0).notNull(),

  // Locked in from Vendor Service at creation time — never client-supplied.
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  paymentTerms: varchar("payment_terms", { length: 100 }).notNull(),

  status: purchaseOrderStatusEnum("status").default("DRAFT").notNull(),

  // Approval accountability — required by the spec's "approval workflow"
  // responsibility. Both are null until the PO is actually approved.
  approvedBy: varchar("approved_by", { length: 255 }),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
