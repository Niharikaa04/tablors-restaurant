-- Loyalty points ledger (additive, idempotent). Run in the Supabase SQL editor
-- before deploying the loyalty code. Creates new tables only: it never drops,
-- truncates or alters existing data. Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS loyalty_settings (
  restaurant_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  earn_spend_paise integer NOT NULL DEFAULT 1000,
  earn_points integer NOT NULL DEFAULT 1,
  exclude_gst boolean NOT NULL DEFAULT true,
  exclude_service_charge boolean NOT NULL DEFAULT true,
  discount_before_points boolean NOT NULL DEFAULT true,
  min_bill_paise integer NOT NULL DEFAULT 0,
  max_points_per_bill integer,
  expiry_months integer,
  min_points_to_redeem integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_customers (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_customers_phone_unique
  ON loyalty_customers (restaurant_id, phone);

CREATE TABLE IF NOT EXISTS loyalty_rewards (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  points_cost integer NOT NULL CHECK (points_cost > 0),
  value_paise integer,
  percent integer,
  max_discount_paise integer,
  quantity integer,
  terms text,
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_rewards_restaurant_idx ON loyalty_rewards (restaurant_id);

-- Append-only ledger: balance = SUM(points). Rows are never updated or deleted.
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL,
  customer_id text NOT NULL,
  type text NOT NULL,
  points integer NOT NULL,
  source_id text,
  idempotency_key text NOT NULL,
  reason text,
  actor text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_tx_idempotency_unique
  ON loyalty_transactions (restaurant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS loyalty_tx_customer_idx
  ON loyalty_transactions (customer_id, created_at);

CREATE TABLE IF NOT EXISTS loyalty_redemptions (
  id text PRIMARY KEY,
  restaurant_id text NOT NULL,
  customer_id text NOT NULL,
  reward_id text NOT NULL,
  bill_id text NOT NULL,
  points integer NOT NULL,
  discount_paise integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'held',
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);
CREATE INDEX IF NOT EXISTS loyalty_redemptions_bill_idx ON loyalty_redemptions (bill_id);
CREATE INDEX IF NOT EXISTS loyalty_redemptions_customer_idx ON loyalty_redemptions (customer_id);
-- At most one active (held/committed) redemption per bill.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_one_active_per_bill
  ON loyalty_redemptions (bill_id) WHERE status IN ('held', 'committed');

CREATE TABLE IF NOT EXISTS loyalty_bill_links (
  bill_id text PRIMARY KEY,
  restaurant_id text NOT NULL,
  customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
