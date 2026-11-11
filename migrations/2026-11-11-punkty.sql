-- Szkolenie z punktami edukacyjnymi (11.11.2026, plan ops/raporty/2026-11-11-punkty-plan.md, 2.B).
-- Tylko dodaje (kolumny z wartościami domyślnymi, nowe tabele, reguły startowe). Idempotentne, w jednej transakcji.
-- Uruchamiać jako superużytkownik poprzedzone SET ROLE <rola aplikacji> (produkcja: kurs, kopia testowa: kurs_dev),
-- żeby nowe tabele należały do roli aplikacji:
--   (echo "SET ROLE kurs_dev;"; cat migrations/2026-11-11-punkty.sql) | sudo -u postgres psql -v ON_ERROR_STOP=1 -d <baza>
--
-- Rejestr uczestnictwa zostaje 5 lat po usunięciu konta: tabele cme_* NIE kasują się kaskadowo z kontem
-- (user_id ON DELETE SET NULL, participant_id = kopia id konta bez klucza obcego).
BEGIN;

-- Pytania: pula (ćwiczenia | test), „nie tasuj”, wykluczenia w losowaniu testu
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pool varchar(10) NOT NULL DEFAULT 'practice';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS no_shuffle boolean NOT NULL DEFAULT false;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS excludes jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$ BEGIN
  ALTER TABLE questions ADD CONSTRAINT questions_pool_check CHECK (pool IN ('practice', 'test'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS questions_pool_status_idx ON questions (pool, status);

-- Moduły: podsumowanie, bibliografia, udział w szkoleniu z punktami (S8 „EKG na LEK” poza szkoleniem)
ALTER TABLE modules ADD COLUMN IF NOT EXISTS summary_md text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS bibliography_md text;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS cme boolean NOT NULL DEFAULT true;

-- Dokumenty kursu ze studia (Program szkolenia)
CREATE TABLE IF NOT EXISTS course_documents (
  key varchar(50) PRIMARY KEY,
  content_md text,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reguły punktów per zawód
CREATE TABLE IF NOT EXISTS cme_rules (
  profession varchar(30) PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  legal_basis text,
  points_formula text,
  points_per_hour numeric(6,2) NOT NULL DEFAULT 0,
  max_points numeric(6,2),
  min_hours numeric(6,2),
  test_required boolean NOT NULL DEFAULT true,
  registry_required boolean NOT NULL DEFAULT false,
  registry_number varchar(200),
  inactive_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Zapis na szkolenie (osoba × zawód)
CREATE TABLE IF NOT EXISTS cme_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  profession varchar(30) NOT NULL,
  pwz varchar(20),
  pwz_warning text,
  specialization varchar(200),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  declaration_text text NOT NULL,
  declaration_at timestamptz NOT NULL,
  terms_version varchar(20),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cme_enrollments_participant_idx ON cme_enrollments (participant_id);
CREATE INDEX IF NOT EXISTS cme_enrollments_user_idx ON cme_enrollments (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS cme_enrollments_participant_profession_uq ON cme_enrollments (participant_id, profession);

-- Dziennik szkolenia (UTC)
CREATE TABLE IF NOT EXISTS cme_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type varchar(40) NOT NULL,
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  enrollment_id uuid REFERENCES cme_enrollments(id),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS cme_log_participant_idx ON cme_log (participant_id, at);
CREATE INDEX IF NOT EXISTS cme_log_type_idx ON cme_log (type, at);

-- Wykłady: pierwsze otwarcie i ukończenie
CREATE TABLE IF NOT EXISTS cme_lecture_progress (
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (participant_id, section_id)
);

-- Moduły: podsumowanie otwarte, moduł ukończony
CREATE TABLE IF NOT EXISTS cme_module_progress (
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  summary_opened_at timestamptz,
  completed_at timestamptz,
  PRIMARY KEY (participant_id, module_id)
);

-- Podejścia do testu zaliczeniowego
CREATE TABLE IF NOT EXISTS cme_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  question_ids jsonb NOT NULL,
  answer_orders jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  grading jsonb,
  score integer,
  max_score integer,
  percent numeric(5,2),
  passed boolean,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS cme_test_attempts_participant_idx ON cme_test_attempts (participant_id, started_at);
-- najwyżej jedno niedokończone podejście na osobę
CREATE UNIQUE INDEX IF NOT EXISTS cme_test_attempts_open_uq ON cme_test_attempts (participant_id) WHERE submitted_at IS NULL;

-- Ankieta: ANONIMOWA (bez user_id i bez dokładnej godziny, tylko miesiąc)
CREATE TABLE IF NOT EXISTS cme_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month varchar(7) NOT NULL,
  survey_version varchar(20) NOT NULL,
  answers jsonb NOT NULL
);

-- Zaświadczenia
CREATE TABLE IF NOT EXISTS cme_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number varchar(30) NOT NULL UNIQUE,
  verification_token varchar(64) NOT NULL UNIQUE,
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  enrollment_id uuid NOT NULL REFERENCES cme_enrollments(id),
  profession varchar(30) NOT NULL,
  snapshot jsonb NOT NULL,
  rule_snapshot jsonb NOT NULL,
  points numeric(6,2),
  hours numeric(6,2) NOT NULL,
  test_attempt_id uuid REFERENCES cme_test_attempts(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  valid boolean NOT NULL DEFAULT true,
  invalidated_at timestamptz,
  invalidated_reason text
);
CREATE INDEX IF NOT EXISTS cme_certificates_participant_idx ON cme_certificates (participant_id);
-- Publiczna weryfikacja po losowym kluczu (128 bitów), nie po kolejnym numerze (numerów nie da się wyliczać).
-- Kopia testowa miała tabelę bez tej kolumny (pierwsza wersja migracji, zero zaświadczeń): dopisujemy.
ALTER TABLE cme_certificates ADD COLUMN IF NOT EXISTS verification_token varchar(64);
ALTER TABLE cme_certificates ALTER COLUMN verification_token SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cme_certificates_verification_token_key ON cme_certificates (verification_token);
-- najwyżej jedno ważne zaświadczenie na osobę i zawód
CREATE UNIQUE INDEX IF NOT EXISTS cme_certificates_valid_uq ON cme_certificates (participant_id, profession) WHERE valid;

CREATE TABLE IF NOT EXISTS cme_certificate_counters (
  year integer PRIMARY KEY,
  last integer NOT NULL DEFAULT 0
);

-- Reguły startowe (plan, sekcja 2.B.7). Istniejących wierszy nie nadpisujemy (zmiany z panelu zostają).
INSERT INTO cme_rules (profession, active, legal_basis, points_formula, points_per_hour, max_points, min_hours, test_required, registry_required, registry_number, inactive_reason) VALUES
  ('lekarz', false,
   'Rozporządzenie Ministra Zdrowia z dnia 21 lutego 2022 r. w sprawie sposobów dopełnienia obowiązku doskonalenia zawodowego lekarzy i lekarzy dentystów (Dz.U. 2022 poz. 464)',
   '1 punkt edukacyjny za 1 godzinę szkolenia, bez limitu', 1, NULL, NULL, true, true, NULL,
   'Organizator nie ma jeszcze wpisu do rejestru podmiotów prowadzących kształcenie ustawiczne lekarzy i lekarzy dentystów, więc to zaświadczenie nie daje punktów edukacyjnych.'),
  ('lekarz_dentysta', false,
   'Rozporządzenie Ministra Zdrowia z dnia 21 lutego 2022 r. w sprawie sposobów dopełnienia obowiązku doskonalenia zawodowego lekarzy i lekarzy dentystów (Dz.U. 2022 poz. 464)',
   '1 punkt edukacyjny za 1 godzinę szkolenia, bez limitu', 1, NULL, NULL, true, true, NULL,
   'Organizator nie ma jeszcze wpisu do rejestru podmiotów prowadzących kształcenie ustawiczne lekarzy i lekarzy dentystów, więc to zaświadczenie nie daje punktów edukacyjnych.'),
  ('ratownik', true,
   'Rozporządzenie Ministra Zdrowia z dnia 18 sierpnia 2023 r. w sprawie doskonalenia zawodowego ratowników medycznych (Dz.U. 2023 poz. 1800)',
   '1 punkt edukacyjny za 1 godzinę szkolenia, najwyżej 10 punktów za jedno szkolenie, szkolenie co najmniej 4 godziny', 1, 10, 4, true, false, NULL,
   NULL),
  ('pielegniarka', false,
   'Uchwała Naczelnej Rady Pielęgniarek i Położnych nr 166/VIII/2025 (ze zmianami)',
   'Według decyzji Naczelnej Rady Pielęgniarek i Położnych', 0, NULL, NULL, true, false, NULL,
   'Szkolenie czeka na decyzję Naczelnej Rady Pielęgniarek i Położnych, więc to zaświadczenie nie daje jeszcze punktów edukacyjnych.'),
  ('polozna', false,
   'Uchwała Naczelnej Rady Pielęgniarek i Położnych nr 166/VIII/2025 (ze zmianami)',
   'Według decyzji Naczelnej Rady Pielęgniarek i Położnych', 0, NULL, NULL, true, false, NULL,
   'Szkolenie czeka na decyzję Naczelnej Rady Pielęgniarek i Położnych, więc to zaświadczenie nie daje jeszcze punktów edukacyjnych.'),
  ('student', false, NULL, 'Bez punktów edukacyjnych', 0, NULL, NULL, true, false, NULL,
   'Punkty edukacyjne przysługują osobom wykonującym zawód medyczny. To zaświadczenie potwierdza ukończenie szkolenia.'),
  ('inny', false, NULL, 'Bez punktów edukacyjnych', 0, NULL, NULL, true, false, NULL,
   'Dla tego zawodu szkolenie nie daje punktów edukacyjnych. To zaświadczenie potwierdza ukończenie szkolenia.')
ON CONFLICT (profession) DO NOTHING;

COMMIT;
