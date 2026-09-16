import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const vendorStatusEnum = pgEnum("vendor_status", [
  "PENDING",
  "APPROVED",
  "SUSPENDED",
  "ARCHIVED",
]);

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),

  contactEmail: varchar("contact_email", { length: 255 }).notNull().unique(),

  contactPhone: varchar("contact_phone", { length: 20 }).notNull(),

  paymentTerms: varchar("payment_terms", { length: 100 }).notNull(),

  leadTimeDays: integer("lead_time_days").notNull(),

  status: vendorStatusEnum("status").default("APPROVED").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const vendorProducts = pgTable(
  "vendor_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    vendorId: uuid("vendor_id")
      .references(() => vendors.id, {
        onDelete: "cascade",
      })
      .notNull(),

    sku: varchar("sku", { length: 100 }).notNull(),

    unitCost: decimal("unit_cost", {
      precision: 10,
      scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // A vendor can only have ONE cost entry per SKU — prevents duplicate/
    // contradictory pricing for the same product from the same supplier.
    // Different vendors CAN still supply the same SKU (that's the point).
    vendorSkuUnique: unique("vendor_products_vendor_id_sku_unique").on(
      table.vendorId,
      table.sku,
    ),
  }),
);
