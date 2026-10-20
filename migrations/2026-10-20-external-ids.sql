-- Identyfikatory ze studia na modułach i tematach: import aktualizuje treść w miejscu (postępy zostają)
BEGIN;
ALTER TABLE modules  ADD COLUMN IF NOT EXISTS external_id varchar(64);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS external_id varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS modules_external_id_uq  ON modules (external_id)  WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sections_external_id_uq ON sections (external_id) WHERE external_id IS NOT NULL;
COMMIT;
