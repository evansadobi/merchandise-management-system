CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"location_id" varchar(100) DEFAULT 'MAIN_WAREHOUSE' NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_allocated" integer DEFAULT 0 NOT NULL,
	"quantity_on_order" integer DEFAULT 0 NOT NULL,
	"unit_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reorder_level" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_items_sku_location_unique" UNIQUE("sku","location_id")
);
