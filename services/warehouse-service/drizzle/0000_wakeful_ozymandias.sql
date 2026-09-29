CREATE TYPE "public"."task_status" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "aisles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aisles_zone_code_unique" UNIQUE("zone_id","code")
);
--> statement-breakpoint
CREATE TABLE "bins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"bin_code" varchar(50) NOT NULL,
	"full_code" varchar(100) NOT NULL,
	"capacity_units" integer NOT NULL,
	"current_utilization" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bins_shelf_bin_unique" UNIQUE("shelf_id","bin_code"),
	CONSTRAINT "bins_full_code_unique" UNIQUE("full_code")
);
--> statement-breakpoint
CREATE TABLE "picking_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"from_bin_id" uuid,
	"status" "task_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_to" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "picking_tasks_transfer_sku_unique" UNIQUE("reference_id","sku")
);
--> statement-breakpoint
CREATE TABLE "putaway_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"suggested_bin_id" uuid,
	"actual_bin_id" uuid,
	"status" "task_status" DEFAULT 'PENDING' NOT NULL,
	"assigned_to" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aisle_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shelves_aisle_code_unique" UNIQUE("aisle_id","code")
);
--> statement-breakpoint
CREATE TABLE "stock_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"bin_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_placements_sku_bin_unique" UNIQUE("sku","bin_id")
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "stock_transfer_items_transfer_sku_unique" UNIQUE("transfer_id","sku")
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_warehouse_id" varchar(100) NOT NULL,
	"to_warehouse_id" varchar(100) NOT NULL,
	"status" "transfer_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warehouse_id" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "zones_warehouse_code_unique" UNIQUE("warehouse_id","code")
);
--> statement-breakpoint
ALTER TABLE "aisles" ADD CONSTRAINT "aisles_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bins" ADD CONSTRAINT "bins_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picking_tasks" ADD CONSTRAINT "picking_tasks_from_bin_id_bins_id_fk" FOREIGN KEY ("from_bin_id") REFERENCES "public"."bins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_suggested_bin_id_bins_id_fk" FOREIGN KEY ("suggested_bin_id") REFERENCES "public"."bins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_actual_bin_id_bins_id_fk" FOREIGN KEY ("actual_bin_id") REFERENCES "public"."bins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_aisle_id_aisles_id_fk" FOREIGN KEY ("aisle_id") REFERENCES "public"."aisles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_placements" ADD CONSTRAINT "stock_placements_bin_id_bins_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."bins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bins_full_code_idx" ON "bins" USING btree ("full_code");--> statement-breakpoint
CREATE INDEX "picking_tasks_status_idx" ON "picking_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "picking_tasks_reference_idx" ON "picking_tasks" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "picking_tasks_sku_idx" ON "picking_tasks" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "putaway_tasks_status_idx" ON "putaway_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "putaway_tasks_grn_idx" ON "putaway_tasks" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX "putaway_tasks_sku_idx" ON "putaway_tasks" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "stock_placements_sku_idx" ON "stock_placements" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "stock_transfer_items_transfer_idx" ON "stock_transfer_items" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers" USING btree ("status");