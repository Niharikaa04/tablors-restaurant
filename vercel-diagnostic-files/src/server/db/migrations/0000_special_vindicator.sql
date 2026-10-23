CREATE TYPE "public"."device_status" AS ENUM('online', 'offline');--> statement-breakpoint
CREATE TYPE "public"."notif_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notif_status" AS ENUM('unread', 'read', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'preparing', 'ready', 'served', 'billed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'qr');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'partial', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('booked', 'checked_in', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."table_status" AS ENUM('available', 'occupied', 'reserved');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'manager', 'cashier', 'kitchen');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "bills" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"order_id" text NOT NULL,
	"table_id" text NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"service_charge_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"payment_method" "payment_method",
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "device_heartbeats" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"device_id" text NOT NULL,
	"battery_percent" integer,
	"firmware_version" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_heartbeats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"device_uid" text NOT NULL,
	"secret_hash" text,
	"table_id" text,
	"status" "device_status" DEFAULT 'offline' NOT NULL,
	"battery_percent" integer,
	"firmware_version" text,
	"signal" text,
	"last_seen_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"city" text NOT NULL,
	"table_count" integer NOT NULL,
	"restaurant_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"category_id" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text NOT NULL,
	"price_paise" integer NOT NULL,
	"veg" boolean DEFAULT false NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"prep_minutes" integer DEFAULT 0 NOT NULL,
	"is_special" boolean DEFAULT false NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"image_mime" text,
	"image_data" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sound" boolean DEFAULT true NOT NULL,
	"quiet_start" text,
	"quiet_end" text
);
--> statement-breakpoint
ALTER TABLE "notification_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"type" text NOT NULL,
	"priority" "notif_priority" NOT NULL,
	"target_roles" text[] NOT NULL,
	"table_id" text,
	"order_id" text,
	"device_id" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"dedupe_key" text,
	"status" "notif_status" DEFAULT 'unread' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"order_id" text NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"menu_item_id" text,
	"code" text NOT NULL,
	"name_snapshot" text NOT NULL,
	"category_snapshot" text,
	"qty" integer NOT NULL,
	"price_paise" integer NOT NULL,
	"base_price_paise" integer,
	"discount_percent" integer,
	"prep_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"session_id" text,
	"table_id" text NOT NULL,
	"device_id" text,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text NOT NULL,
	"guest_name" text NOT NULL,
	"phone" text NOT NULL,
	"party_size" integer NOT NULL,
	"reserved_for" timestamp with time zone NOT NULL,
	"status" "reservation_status" DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reservations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tables" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"area_id" text,
	"label" text NOT NULL,
	"number" integer,
	"status" "table_status" DEFAULT 'available' NOT NULL,
	"current_order_id" text,
	"waiter_called" boolean DEFAULT false NOT NULL,
	"waiter_called_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_name" text,
	"phone" text,
	"email" text,
	"city" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "restaurants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"restaurant_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "table_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "table_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"pin_hash" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "waiter_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"restaurant_id" text NOT NULL,
	"table_id" text NOT NULL,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" text
);
--> statement-breakpoint
ALTER TABLE "waiter_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "areas_restaurant_name_unique" ON "areas" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "areas_restaurant_idx" ON "areas" USING btree ("restaurant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_order_unique" ON "bills" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "bills_restaurant_idx" ON "bills" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_restaurant_name_unique" ON "categories" USING btree ("restaurant_id","name");--> statement-breakpoint
CREATE INDEX "categories_restaurant_idx" ON "categories" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "device_heartbeats_device_idx" ON "device_heartbeats" USING btree ("device_id","seen_at");--> statement-breakpoint
CREATE INDEX "device_heartbeats_restaurant_idx" ON "device_heartbeats" USING btree ("restaurant_id","seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_uid_unique" ON "devices" USING btree ("device_uid");--> statement-breakpoint
CREATE INDEX "devices_restaurant_idx" ON "devices" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "devices_table_idx" ON "devices" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "leads_received_idx" ON "leads" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_active_code_unique" ON "menu_items" USING btree ("restaurant_id","code") WHERE "menu_items"."archived_at" IS NULL;--> statement-breakpoint
CREATE INDEX "menu_items_restaurant_idx" ON "menu_items" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "menu_items_category_idx" ON "menu_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "notif_restaurant_created_idx" ON "notifications" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "notif_dedupe_idx" ON "notifications" USING btree ("restaurant_id","dedupe_key","status");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_events_restaurant_idx" ON "order_events" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_menu_item_idx" ON "order_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "orders_restaurant_created_idx" ON "orders" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_table_idx" ON "orders" USING btree ("table_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("restaurant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_device_idempotency_unique" ON "orders" USING btree ("device_id","idempotency_key") WHERE "orders"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_bill_idx" ON "payments" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "payments_restaurant_idx" ON "payments" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_txn_unique" ON "payments" USING btree ("restaurant_id",lower("transaction_id")) WHERE "payments"."transaction_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_bill_idx" ON "refunds" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "refunds_restaurant_idx" ON "refunds" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "reservations_restaurant_time_idx" ON "reservations" USING btree ("restaurant_id","reserved_for");--> statement-breakpoint
CREATE INDEX "reservations_table_time_idx" ON "reservations" USING btree ("table_id","reserved_for");--> statement-breakpoint
CREATE UNIQUE INDEX "tables_restaurant_number_unique" ON "tables" USING btree ("restaurant_id","number");--> statement-breakpoint
CREATE INDEX "tables_restaurant_idx" ON "tables" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "tables_area_idx" ON "tables" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_restaurant_idx" ON "sessions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "table_sessions_restaurant_idx" ON "table_sessions" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "table_sessions_table_idx" ON "table_sessions" USING btree ("table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_restaurant_idx" ON "users" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "waiter_calls_restaurant_idx" ON "waiter_calls" USING btree ("restaurant_id","called_at");--> statement-breakpoint
CREATE INDEX "waiter_calls_table_idx" ON "waiter_calls" USING btree ("table_id","called_at");