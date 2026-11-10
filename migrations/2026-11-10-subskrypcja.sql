-- 10.11.2026: plan miesięczny jako subskrypcja Stripe (49 zł/mies.), roczny jednorazowo (499 zł / 365 dni)
BEGIN;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS "interval" varchar(10);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_stripe_subscription_id_unique') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_stripe_subscription_id_unique UNIQUE (stripe_subscription_id);
  END IF;
END $$;
-- dawne propozycje (60/100/169 zł), jeśli były założone: wyłączone
UPDATE plans SET is_active = false WHERE name LIKE 'Dostęp do kursu: % dni';
INSERT INTO plans (name, price, duration_days, currency, "interval", is_active)
SELECT 'helloEKG: miesięcznie', 49.00, 30, 'PLN', 'month', true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'helloEKG: miesięcznie');
INSERT INTO plans (name, price, duration_days, currency, "interval", is_active)
SELECT 'helloEKG: rok', 499.00, 365, 'PLN', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'helloEKG: rok');
COMMIT;
