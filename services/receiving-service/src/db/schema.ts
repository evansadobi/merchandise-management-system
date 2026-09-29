import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const grnStatusEnum = pgEnum("grn_status", ["COMPLETE", "DISCREPANCY"]);

export const expectedDeliveryStatusEnum = pgEnum("expected_delivery_status", [
  "PENDING",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
]);

export const expectedDeliveries = pgTable(
  "expected_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    quantityExpected: integer("quantity_expected").notNull(),
    quantityReceivedSoFar: integer("quantity_received_so_far")
      .notNull()
      .default(0),
    status: expectedDeliveryStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("po_sku_idx").on(table.purchaseOrderId, table.sku),
    index("expected_deliveries_po_idx").on(table.purchaseOrderId),
  ],
);

export const goodsReceivedNotes = pgTable(
  "goods_received_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    supplierId: uuid("supplier_id").notNull(),
    receivedBy: varchar("received_by", { length: 255 }).notNull(),
    status: grnStatusEnum("status").notNull().default("COMPLETE"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("grn_po_idx").on(table.purchaseOrderId)],
);

export const receivingItems = pgTable(
  "receiving_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grnId: uuid("grn_id")
      .references(() => goodsReceivedNotes.id, { onDelete: "cascade" })
      .notNull(),
    expectedDeliveryId: uuid("expected_delivery_id").references(
      () => expectedDeliveries.id,
    ),
    sku: varchar("sku", { length: 100 }).notNull(),
    orderedQuantity: integer("ordered_quantity").notNull(),
    receivedQuantity: integer("received_quantity").notNull(),
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    conditionNotes: varchar("condition_notes", { length: 500 }),
  },
  (table) => [
    index("receiving_items_grn_idx").on(table.grnId),
    index("receiving_items_sku_idx").on(table.sku),
  ],
);
