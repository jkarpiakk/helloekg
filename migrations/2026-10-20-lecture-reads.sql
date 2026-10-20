-- Wznowienie wykładu: ostatni rozdział per użytkownik i sekcja (idempotentne)
BEGIN;
CREATE TABLE IF NOT EXISTS lecture_reads (
  user_id        uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  section_id     uuid        NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  chapter_order  integer     NOT NULL CHECK (chapter_order >= 1),
  chapters_total integer     NOT NULL CHECK (chapters_total >= 1),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section_id),
  CHECK (chapter_order <= chapters_total)
);
COMMIT;
