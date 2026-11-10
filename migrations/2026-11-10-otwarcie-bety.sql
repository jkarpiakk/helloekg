-- Otwarcie bety (10.11.2026): rejestracja ze zgodami, potwierdzenie adresu, przełączniki w panelu,
-- idempotencja webhooka Stripe po event.id i zwroty. Idempotentne (IF NOT EXISTS), w jednej transakcji.
-- Uruchamiać jako superużytkownik: SET ROLE kurs sprawia, że nowe tabele należą do roli aplikacji.
BEGIN;
SET ROLE kurs;

-- Konta: PWZ (pod przyszłe punkty edukacyjne, formularz go nie zbiera), tester bety, ważność linku potwierdzającego
ALTER TABLE users ADD COLUMN IF NOT EXISTS pwz_number varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tester_bety boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expiry timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp;

-- Tokeny potwierdzające były w bazie jawnie; od teraz tylko skrót SHA-256 z terminem 24 h.
-- Stare jawne tokeny kasujemy (niepotwierdzone konto poprosi o nowy link).
UPDATE users SET email_verification_token = NULL, email_verification_expiry = NULL
  WHERE email_verification_token IS NOT NULL;

-- Konta sprzed otwarcia to testerzy bety (dostęp bez płatności zastępuje BETA_OPEN_ACCESS)
UPDATE users SET tester_bety = true WHERE role = 'student' AND tester_bety = false;

-- Subskrypcja pamięta płatność Stripe (payment_intent): zwrot całej kwoty odbiera dostęp
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id varchar(255);
CREATE INDEX IF NOT EXISTS subscriptions_payment_intent_idx ON subscriptions (stripe_payment_intent_id);

-- Plan techniczny „Manual” (dostęp nadany ręcznie) nigdy nie jest w sprzedaży
UPDATE plans SET is_active = false WHERE name = 'Manual' AND is_active;

-- Zdarzenia webhooka Stripe już obsłużone (to samo event.id przetwarzamy raz)
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id varchar(255) PRIMARY KEY,
  type varchar(100) NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Zgody przy rejestracji: dokument, wersja, data
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document varchar(50) NOT NULL,
  version varchar(20) NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_consents_user_idx ON user_consents (user_id);

-- Przełączniki z panelu admina (REJESTRACJA_OTWARTA, publikacja dokumentów, wyjątki limitów dla pentestu)
CREATE TABLE IF NOT EXISTS app_settings (
  key varchar(100) PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

RESET ROLE;
COMMIT;
