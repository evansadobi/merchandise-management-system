CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" varchar(100) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"location_id" varchar(100) DEFAULT 'MAIN_WAREHOUSE' NOT NULL,
	"quantity" integer NOT NULL,
	"status" varchar(20) DEFAULT 'RESERVED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_reservations_sale_sku_loc_unique" UNIQUE("sale_id","sku","location_id")
);
--> statement-breakpoint
CREATE INDEX "inventory_reservations_sale_idx" ON "inventory_reservations" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_status_idx" ON "inventory_reservations" USING btree ("status");