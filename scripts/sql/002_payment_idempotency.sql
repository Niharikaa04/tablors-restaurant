-- Additive, idempotent migration: duplicate-payment protection.
-- Safe to run more than once. Never drops, truncates or rewrites existing data.
-- Run BEFORE deploying code that writes payments.idempotency_key.

BEGIN;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key text;

-- One payment per submission key per restaurant (NULL keys are unconstrained,
-- so every existing row stays valid).
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_unique
  ON payments (restaurant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Already enforced by the original schema; repeated here only as IF NOT EXISTS
-- so a database created by hand also has it: one transaction reference per
-- restaurant, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS payments_txn_unique
  ON payments (restaurant_id, lower(transaction_id))
  WHERE transaction_id IS NOT NULL;

COMMIT;
