-- Szkolenie z punktami, poprawki po przeglądzie 11.11.2026 (/private/tmp/…/review-kurs/RAPORT.md, decyzje JK).
-- Po 2026-11-11-punkty.sql. Tylko dodaje albo luzuje (kolumny, tabela, zdjęte klucze obce z kaskadą, CHECK),
-- idempotentna, w jednej transakcji. Uruchamiać jak pierwszą:
--   (echo "SET ROLE kurs_dev;"; cat migrations/2026-11-11-punkty-2.sql) | sudo -u postgres psql -v ON_ERROR_STOP=1 -d <baza>
BEGIN;

-- H2: okres obowiązywania reguły punktów (punkty nie działają wstecz) i data uchwały NRL
ALTER TABLE cme_rules ADD COLUMN IF NOT EXISTS nrl_resolution_at date;
ALTER TABLE cme_rules ADD COLUMN IF NOT EXISTS obowiazuje_od date;
ALTER TABLE cme_rules ADD COLUMN IF NOT EXISTS obowiazuje_do date;
DO $$ BEGIN
  ALTER TABLE cme_rules ADD CONSTRAINT cme_rules_obowiazuje_check
    CHECK (obowiazuje_do IS NULL OR obowiazuje_od IS NULL OR obowiazuje_do >= obowiazuje_od);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE cme_rules ADD CONSTRAINT cme_rules_points_mode_check CHECK (points_mode IN ('godziny', 'decyzja'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE cme_certificates ADD CONSTRAINT cme_certificates_kind_check CHECK (kind IN ('punkty', 'ukonczenie'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M7: każdy rozdział wykładu otwarty (pierwsze otwarcie, z godziną); bez pomiaru czasu
CREATE TABLE IF NOT EXISTS cme_chapter_progress (
  participant_id uuid NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  section_id uuid NOT NULL,
  lecture_external_id varchar(64),
  chapter_order integer NOT NULL,
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (participant_id, section_id, chapter_order)
);

-- M8: usunięcie albo ponowny import treści nie kasuje rejestru szkolenia (bez kaskady z sekcji i modułów)
-- oraz kopie identyfikatorów i tytułów (dopasowanie po imporcie z nowymi id)
ALTER TABLE cme_lecture_progress DROP CONSTRAINT IF EXISTS cme_lecture_progress_section_id_fkey;
ALTER TABLE cme_module_progress DROP CONSTRAINT IF EXISTS cme_module_progress_module_id_fkey;
ALTER TABLE cme_lecture_progress ADD COLUMN IF NOT EXISTS lecture_external_id varchar(64);
ALTER TABLE cme_lecture_progress ADD COLUMN IF NOT EXISTS lecture_title varchar(200);
ALTER TABLE cme_lecture_progress ADD COLUMN IF NOT EXISTS module_id uuid;
ALTER TABLE cme_lecture_progress ADD COLUMN IF NOT EXISTS module_external_id varchar(64);
ALTER TABLE cme_module_progress ADD COLUMN IF NOT EXISTS module_external_id varchar(64);
ALTER TABLE cme_module_progress ADD COLUMN IF NOT EXISTS module_title varchar(200);
UPDATE cme_lecture_progress p SET lecture_external_id = s.external_id, lecture_title = s.title, module_id = s.module_id, module_external_id = m.external_id
  FROM sections s JOIN modules m ON m.id = s.module_id
 WHERE s.id = p.section_id AND p.lecture_title IS NULL;
UPDATE cme_module_progress p SET module_external_id = m.external_id, module_title = m.title
  FROM modules m WHERE m.id = p.module_id AND p.module_title IS NULL;
-- kopia wylosowanych pytań w podejściu (ocena i wgląd z kopii)
ALTER TABLE cme_test_attempts ADD COLUMN IF NOT EXISTS question_snapshot jsonb;

-- M9: kto działał, także po usunięciu konta admina
ALTER TABLE cme_log ADD COLUMN IF NOT EXISTS actor_snapshot jsonb;
ALTER TABLE cme_enrollments ADD COLUMN IF NOT EXISTS pwz_verified_by_snapshot jsonb;
UPDATE cme_log l SET actor_snapshot = jsonb_build_object('id', u.id, 'email', u.email, 'imie', u.first_name, 'rola', u.role)
  FROM users u WHERE u.id = l.actor_id AND l.actor_snapshot IS NULL;
UPDATE cme_enrollments e SET pwz_verified_by_snapshot = jsonb_build_object('id', u.id, 'email', u.email, 'imie', u.first_name, 'rola', u.role)
  FROM users u WHERE u.id = e.pwz_verified_by AND e.pwz_verified_by_snapshot IS NULL;

COMMIT;
