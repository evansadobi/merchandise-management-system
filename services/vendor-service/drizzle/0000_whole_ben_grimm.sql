CREATE TYPE "public"."vendor_status" AS ENUM('PENDING', 'APPROVED', 'SUSPENDED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "vendor_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"sku" varchar(100) NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_products_vendor_id_sku_unique" UNIQUE("vendor_id","sku")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"contact_phone" varchar(20) NOT NULL,
	"payment_terms" varchar(100) NOT NULL,
	"lead_time_days" integer NOT NULL,
	"status" "vendor_status" DEFAULT 'APPROVED' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_contact_email_unique" UNIQUE("contact_email")
);
--> statement-breakpoint
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;