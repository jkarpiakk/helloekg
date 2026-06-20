---
name: drizzle-kit push interactive prompt
description: Why `npx drizzle-kit push --force` can hang/fail in this env and how to add a table reliably.
---

`npx drizzle-kit push --force` does NOT skip the "table created or renamed?" prompt when a new table name is similar to an existing one (e.g. adding `exam_sessions` while a connect-pg-simple `session` table exists, drizzle asks create-vs-rename). It uses raw TTY mode, so piping stdin (`printf '\n' | ...`) is ignored and the command just hangs on the prompt.

**Workaround:** create the table directly with raw SQL that matches the Drizzle definition exactly (via the executeSql code-execution callback), then the schema and DB stay in sync. Verify with an `information_schema.columns` query.

**Why:** the interactive rename/create disambiguation cannot be answered non-interactively here, and there is no flag to force "create new".

**How to apply:** when adding a table whose name resembles an existing one, skip `drizzle-kit push` and run `CREATE TABLE ...` matching the schema (uuid PKs use `gen_random_uuid()`), or pick a name unlikely to be confused with another table.
