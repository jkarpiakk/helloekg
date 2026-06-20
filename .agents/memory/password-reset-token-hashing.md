---
name: Password reset token hashing
description: How password-reset tokens are generated, stored, and verified to prevent token-theft attacks.
---

Flow: `authService.initiatePasswordReset(email)` generates a 32-byte random token with `crypto.randomBytes`, stores its SHA-256 hex hash in `users.passwordResetToken`, and returns the **plaintext** token (which goes in the email link only).

Verification in `authService.resetPassword(token, newPassword)`: hashes the incoming token, then queries `storage.getUserByPasswordResetToken(hash)`. If found and not expired (60-min window), updates the password and calls `storage.invalidateUserSessions(userId)`.

`invalidateUserSessions` deletes rows from the `session` table where `sess::jsonb->>'userId' = $userId`.

**Why:** Storing plaintext reset tokens means a DB breach exposes account-takeover tokens. Hashing them means an attacker with DB read access still can't reset accounts.

**How to apply:** Always hash on store, hash on lookup — never compare plaintext to plaintext from DB.
