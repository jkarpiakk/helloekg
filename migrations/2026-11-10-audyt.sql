-- 10.11.2026, audyt bezpieczeństwa: jeden e-mail bez względu na wielkość liter (wyszukiwanie już jest bez niej)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (lower(email));
