import {
  pgEnum,
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const taskStatusEnum = pgEnum("task_status", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "PENDING",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
]);

export const zones = pgTable(
  "zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: varchar("warehouse_id", { length: 100 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(), // "FAST" | "MID" | "BULK"
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    warehouseCodeUnique: unique("zones_warehouse_code_unique").on(
      table.warehouseId,
      table.code,
    ),
  }),
);

export const aisles = pgTable(
  "aisles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(), // "A", "B"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    zoneCodeUnique: unique("aisles_zone_code_unique").on(
      table.zoneId,
      table.code,
    ),
  }),
);

export const shelves = pgTable(
  "shelves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    aisleId: uuid("aisle_id")
      .notNull()
      .references(() => aisles.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 50 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    aisleCodeUnique: unique("shelves_aisle_code_unique").on(
      table.aisleId,
      table.code,
    ),
  }),
);

export const bins = pgTable(
  "bins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shelfId: uuid("shelf_id")
      .notNull()
      .references(() => shelves.id, { onDelete: "cascade" }),
    binCode: varchar("bin_code", { length: 50 }).notNull(),
    fullCode: varchar("full_code", { length: 100 }).notNull(),
    capacityUnits: integer("capacity_units").notNull(),
    currentUtilization: integer("current_utilization").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    shelfBinUnique: unique("bins_shelf_bin_unique").on(
      table.shelfId,
      table.binCode,
    ),
    fullCodeUnique: unique("bins_full_code_unique").on(table.fullCode),
    fullCodeIdx: index("bins_full_code_idx").on(table.fullCode),
  }),
);

export const stockPlacements = pgTable(
  "stock_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sku: varchar("sku", { length: 100 }).notNull(),
    binId: uuid("bin_id")
      .notNull()
      .references(() => bins.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    skuBinUnique: unique("stock_placements_sku_bin_unique").on(
      table.sku,
      table.binId,
    ),
    skuIdx: index("stock_placements_sku_idx").on(table.sku),
  }),
);

export const putawayTasks = pgTable(
  "putaway_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    grnId: uuid("grn_id").notNull(),
    purchaseOrderId: uuid("purchase_order_id").notNull(),
    sku: varchar("sku", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
    suggestedBinId: uuid("suggested_bin_id").references(() => bins.id, {
      onDelete: "set null",
    }),
    actualBinId: uuid("actual_bin_id").references(() => bins.id, {
      onDelete: "set null",
    }),
    status: taskStatusEnum("status").default("PENDING").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    statusIdx: index("putaway_tasks_status_idx").on(table.status),
    grnIdx: index("putaway_tasks_grn_idx").on(table.grnId),
    skuIdx: index("putaway_tasks_sku_idx").on(table.sku),
  }),
);

export const pickingTasks = pgTable(
  "picking_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceId: uuid("reference_id").notNull(), // transfer id
    sku: varchar("sku", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
    fromBinId: uuid("from_bin_id").references(() => bins.id, {
      onDelete: "set null",
    }),
    status: taskStatusEnum("status").default("PENDING").notNull(),
    assignedTo: varchar("assigned_to", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    statusIdx: index("picking_tasks_status_idx").on(table.status),
    referenceIdx: index("picking_tasks_reference_idx").on(table.referenceId),
    skuIdx: index("picking_tasks_sku_idx").on(table.sku),

    transferSkuUnique: unique("picking_tasks_transfer_sku_unique").on(
      table.referenceId,
      table.sku,
    ),
  }),
);

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromWarehouseId: varchar("from_warehouse_id", { length: 100 }).notNull(),
    toWarehouseId: varchar("to_warehouse_id", { length: 100 }).notNull(),
    status: transferStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    statusIdx: index("stock_transfers_status_idx").on(table.status),
  }),
);

export const stockTransferItems = pgTable(
  "stock_transfer_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 100 }).notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => ({
    transferIdx: index("stock_transfer_items_transfer_idx").on(
      table.transferId,
    ),
    transferSkuUnique: unique("stock_transfer_items_transfer_sku_unique").on(
      table.transferId,
      table.sku,
    ),
  }),
);
