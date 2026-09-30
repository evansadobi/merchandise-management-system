CREATE TABLE "financial_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_id" varchar(100) NOT NULL,
	"entry_type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(20) DEFAULT 'KES' NOT NULL,
	"description" varchar(255) NOT NULL,
	"reference_type" varchar(60),
	"reference_id" varchar(150),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_id" varchar(100) NOT NULL,
	"name" varchar(150) NOT NULL,
	"type" varchar(60) NOT NULL,
	"currency" varchar(20) DEFAULT 'KES' NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
