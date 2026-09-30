import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    productName: varchar("product_name", { length: 255 }).notNull(),

    sku: varchar("sku", { length: 100 }).notNull(),

    locationId: varchar("location_id", { length: 100 })
      .notNull()
      .default("MAIN_WAREHOUSE"),

    quantityOnHand: integer("quantity_on_hand").notNull().default(0),

    quantityAllocated: integer("quantity_allocated").notNull().default(0),

    quantityOnOrder: integer("quantity_on_order").notNull().default(0),

    unitValue: decimal("unit_value", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),

    reorderLevel: integer("reorder_level").notNull().default(10),

    weightKg: decimal("weight_kg", { precision: 10, scale: 3 }),

    volumeCm3: integer("volume_cm3"),

    salesVelocity: varchar("sales_velocity", { length: 20 }), // "HIGH" | "MEDIUM" | "LOW"

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    skuLocationUnique: unique("inventory_items_sku_location_unique").on(
      table.sku,
      table.locationId,
    ),
  }),
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    saleId: varchar("sale_id", { length: 100 }).notNull(),

    sku: varchar("sku", { length: 100 }).notNull(),

    locationId: varchar("location_id", { length: 100 })
      .notNull()
      .default("MAIN_WAREHOUSE"),

    quantity: integer("quantity").notNull(),

    status: varchar("status", { length: 20 }).notNull().default("RESERVED"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    saleSkuLocationUnique: unique(
      "inventory_reservations_sale_sku_loc_unique",
    ).on(table.saleId, table.sku, table.locationId),
    saleIdIdx: index("inventory_reservations_sale_idx").on(table.saleId),
    statusIdx: index("inventory_reservations_status_idx").on(table.status),
  }),
);
