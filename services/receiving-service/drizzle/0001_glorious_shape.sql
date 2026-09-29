ALTER TABLE "goods_received_notes" DROP CONSTRAINT "goods_received_notes_purchase_order_id_expected_deliveries_purchase_order_id_fk";
--> statement-breakpoint
ALTER TABLE "expected_deliveries" DROP CONSTRAINT "expected_deliveries_purchase_order_id_unique";
--> statement-breakpoint
ALTER TABLE "receiving_items" ADD COLUMN "expected_delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "receiving_items" ADD CONSTRAINT "receiving_items_expected_delivery_id_expected_deliveries_id_fk" FOREIGN KEY ("expected_delivery_id") REFERENCES "public"."expected_deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "po_sku_idx" ON "expected_deliveries" USING btree ("purchase_order_id","sku");--> statement-breakpoint
CREATE INDEX "expected_deliveries_po_idx" ON "expected_deliveries" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "grn_po_idx" ON "goods_received_notes" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "receiving_items_grn_idx" ON "receiving_items" USING btree ("grn_id");--> statement-breakpoint
CREATE INDEX "receiving_items_sku_idx" ON "receiving_items" USING btree ("sku");