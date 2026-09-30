import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";

export const retailSalesTransactions = pgTable("retail_sales_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: varchar("sale_id", { length: 100 }).notNull(),
  storeId: varchar("store_id", { length: 100 }).notNull(),
  registerId: varchar("register_id", { length: 100 }).notNull(),
  customerId: varchar("customer_id", { length: 100 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 40 }).notNull(),
  status: varchar("status", { length: 30 }).notNull().default("PAID"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const retailSalesSchema = {
  retailSalesTransactions,
};
