CREATE TYPE "public"."expected_delivery_status" AS ENUM('PENDING', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED');--> statement-breakpoint
CREATE TYPE "public"."grn_status" AS ENUM('COMPLETE', 'DISCREPANCY');--> statement-breakpoint
CREATE TABLE "expected_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"quantity_expected" integer NOT NULL,
	"quantity_received_so_far" integer DEFAULT 0 NOT NULL,
	"status" "expected_delivery_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "expected_deliveries_purchase_order_id_unique" UNIQUE("purchase_order_id")
);
--> statement-breakpoint
CREATE TABLE "goods_received_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"received_by" varchar(255) NOT NULL,
	"status" "grn_status" DEFAULT 'COMPLETE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receiving_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grn_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"ordered_quantity" integer NOT NULL,
	"received_quantity" integer NOT NULL,
	"damaged_quantity" integer DEFAULT 0 NOT NULL,
	"condition_notes" varchar(500)
);
--> statement-breakpoint
ALTER TABLE "goods_received_notes" ADD CONSTRAINT "goods_received_notes_purchase_order_id_expected_deliveries_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."expected_deliveries"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_grn_id_goods_received_notes_id_fk" FOREIGN KEY ("grn_id") REFERENCES "public"."goods_received_notes"("id") ON DELETE cascade ON UPDATE no action;