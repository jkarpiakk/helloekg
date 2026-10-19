-- 2026-10-19 — poprawki bezpieczeństwa (przegląd OWASP)
-- Idempotentna: można uruchomić wielokrotnie.
--   1. users.suspended_at — prawdziwe zawieszanie kont
--   2. audit_log.actor_id — nullable + ON DELETE SET NULL (usunięcie konta nie jest blokowane)
--   3. support_tickets.admin_user_id / assigned_to — ON DELETE SET NULL (usunięcie konta zespołu)

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at timestamp;

ALTER TABLE audit_log ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_users_id_fk;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_id_users_id_fk
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_admin_user_id_users_id_fk;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_admin_user_id_users_id_fk
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_assigned_to_users_id_fk;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_assigned_to_users_id_fk
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
