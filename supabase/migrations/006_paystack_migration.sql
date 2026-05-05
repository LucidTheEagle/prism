-- 006_paystack_migration.sql
-- Renames Stripe-specific columns on the subscriptions table to
-- provider-agnostic Paystack equivalents.
-- Safe to run on existing data — RENAME COLUMN preserves all values.

ALTER TABLE subscriptions
  RENAME COLUMN stripe_customer_id TO paystack_customer_code;

ALTER TABLE subscriptions
  RENAME COLUMN stripe_subscription_id TO paystack_subscription_code;

-- Update the index on the old subscription ID column if it exists
DROP INDEX IF EXISTS subscriptions_stripe_subscription_id_idx;

CREATE INDEX IF NOT EXISTS subscriptions_paystack_subscription_code_idx
  ON subscriptions (paystack_subscription_code);

COMMENT ON COLUMN subscriptions.paystack_customer_code IS
  'Paystack customer code — format CUS_xxxxxxxxxxxx';

COMMENT ON COLUMN subscriptions.paystack_subscription_code IS
  'Paystack subscription code — format SUB_xxxxxxxxxxxx';