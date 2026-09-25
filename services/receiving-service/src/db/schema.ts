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

// --- ENUMS ---

// Status of the overall Goods Received Note (GRN)
export const grnStatusEnum = pgEnum("grn_status", [
  "COMPLETE", // Everything received matched the expected quantities with zero damages
  "DISCREPANCY", // At least one shortage, overage, or damaged item was flagged
]);

// Status tracking for partial or full fulfillment of expected items
export const expectedDeliveryStatusEnum = pgEnum("expected_delivery_status", [
  "PENDING", // PO approved by Procurement, waiting for physical delivery
  "PARTIALLY_RECEIVED", // Partial shipment received at the dock
  "FULLY_RECEIVED", // Full expected quantity checked in
]);

// --- TABLES ---

/**
 * EXPECTED DELIVERIES (Local Read-Model Cache)
 *
 * Populated asynchronously by consuming `PurchaseOrderApproved` events from Procurement.
 * Adheres strictly to Database Isolation: Receiving maintains its own local cache of expected
 * order items so dock workers can perform fast, local validation without cross-database queries.
 */
export const expectedDeliveries = pgTable(
  "expected_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull(), // Id from Procurement Service
    supplierId: uuid("supplier_id").notNull(), // Mapped from Procurement's vendorId
    sku: varchar("sku", { length: 100 }).notNull(),
    quantityExpected: integer("quantity_expected").notNull(),
    quantityReceivedSoFar: integer("quantity_received_so_far")
      .notNull()
      .default(0),
    status: expectedDeliveryStatusEnum("status").notNull().default("PENDING"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Allows a PO to have multiple distinct SKUs while preventing duplicate cache entries
    uniqueIndex("po_sku_idx").on(table.purchaseOrderId, table.sku),
    index("expected_deliveries_po_idx").on(table.purchaseOrderId),
  ],
);

/**
 * GOODS RECEIVED NOTES (GRN Header)
 *
 * Official record generated when a physical delivery truck arrives at the loading dock.
 */
export const goodsReceivedNotes = pgTable(
  "goods_received_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id").notNull(), // Scalar reference (no cross-service FK)
    supplierId: uuid("supplier_id").notNull(),
    receivedBy: varchar("received_by", { length: 255 }).notNull(), // Dock worker identifier
    status: grnStatusEnum("status").notNull().default("COMPLETE"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("grn_po_idx").on(table.purchaseOrderId)],
);

/**
 * RECEIVING ITEMS (GRN Line Items)
 *
 * Line items checked and scanned at the loading dock per SKU.
 *
 * - `receivedQuantity`: TOTAL physical units delivered (good + damaged combined).
 *   Shortage/overage is computed against this total, since condition and
 *   quantity are independent facts about a delivery — a shipment can arrive
 *   with the correct total count but some units damaged, or arrive short
 *   with zero damage.
 * - `orderedQuantity = 0`: Identifies genuine overages (items delivered that were NOT on the original PO).
 * - `damagedQuantity`: Subset of `receivedQuantity`. Explicit quarantine metric —
 *   damaged units are excluded from the sellable quantity reported to Inventory
 *   via the GoodsReceived event (sellable = receivedQuantity - damagedQuantity).
 */
export const receivingItems = pgTable(
  "receiving_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grnId: uuid("grn_id")
      .references(() => goodsReceivedNotes.id, { onDelete: "cascade" })
      .notNull(),
    expectedDeliveryId: uuid("expected_delivery_id").references(
      () => expectedDeliveries.id,
    ), // Nullable to accommodate un-ordered/overage SKUs
    sku: varchar("sku", { length: 100 }).notNull(),
    orderedQuantity: integer("ordered_quantity").notNull(), // Expected for this shipment (0 if un-ordered)
    receivedQuantity: integer("received_quantity").notNull(), // TOTAL physical units delivered (good + damaged)
    damagedQuantity: integer("damaged_quantity").notNull().default(0), // Subset of receivedQuantity that arrived damaged
    conditionNotes: varchar("condition_notes", { length: 500 }),
  },
  (table) => [
    index("receiving_items_grn_idx").on(table.grnId),
    index("receiving_items_sku_idx").on(table.sku),
  ],
);
