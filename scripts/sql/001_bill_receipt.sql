-- Additive, idempotent migration for itemised bills / printable receipts.
-- Safe to run more than once. Never drops, truncates or rewrites existing data
-- (other than filling the new line_total_paise column on legacy rows).
-- Run BEFORE deploying the code that reads these columns.

BEGIN;

-- Stored line total for every ordered item (qty * unit price, in paise).
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total_paise integer;
UPDATE order_items
   SET line_total_paise = qty * price_paise
 WHERE line_total_paise IS NULL;

-- Human-readable sequence numbers (BILL-001 / ORD-001). Identity columns
-- back-fill existing rows automatically.
ALTER TABLE bills  ADD COLUMN IF NOT EXISTS bill_number  integer GENERATED ALWAYS AS IDENTITY;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number integer GENERATED ALWAYS AS IDENTITY;

COMMIT;