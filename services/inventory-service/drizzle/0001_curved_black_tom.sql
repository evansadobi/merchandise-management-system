ALTER TABLE "inventory_items" ADD COLUMN "weight_kg" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "volume_cm3" integer;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "sales_velocity" varchar(20);