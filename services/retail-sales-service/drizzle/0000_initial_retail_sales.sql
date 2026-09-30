CREATE TABLE "retail_sales_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" varchar(100) NOT NULL,
	"store_id" varchar(100) NOT NULL,
	"register_id" varchar(100) NOT NULL,
	"customer_id" varchar(100) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_method" varchar(40) NOT NULL,
	"status" varchar(30) DEFAULT 'PAID' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
