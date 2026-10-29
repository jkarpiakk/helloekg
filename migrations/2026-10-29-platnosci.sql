-- Płatności: subskrypcja pamięta sesję Stripe Checkout, z której powstała (idempotentne).
-- Ograniczenie UNIQUE pod nazwą, jakiej używa drizzle (.unique()), żeby drizzle-kit push nie dublował.
BEGIN;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_checkout_session_id varchar(255);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_stripe_checkout_session_id_unique') THEN
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_stripe_checkout_session_id_unique UNIQUE (stripe_checkout_session_id);
  END IF;
END $$;
COMMIT;
