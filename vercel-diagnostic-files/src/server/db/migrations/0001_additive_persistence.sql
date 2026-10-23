-- Additive and idempotent: creates one table and adds one nullable column.
-- Never drops, renames, truncates or rewrites existing data.
CREATE TABLE IF NOT EXISTS "app_documents" (
	"restaurant_id" text NOT NULL,
	"collection" text NOT NULL,
	"id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_documents_restaurant_id_collection_id_pk" PRIMARY KEY("restaurant_id","collection","id")
);
--> statement-breakpoint
ALTER TABLE "app_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_documents_collection_idx" ON "app_documents" USING btree ("restaurant_id","collection");