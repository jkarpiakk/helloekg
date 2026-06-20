---
name: Session & cookie hardening
description: How SESSION_SECRET is enforced and what cookie flags are set on express-session.
---

SESSION_SECRET is read inside an IIFE that throws with a clear message if the env var is missing — the app refuses to start rather than silently using a weak default.

Cookie flags: `httpOnly: true`, `secure: process.env.NODE_ENV === "production"` (false in dev so cookies work without HTTPS), `sameSite: "lax"`, `maxAge: 7 * 24 * 60 * 60 * 1000` (7 days).

**Why:** Session fixation and cookie theft via XSS are critical auth vulnerabilities; a missing secret would mean all sessions share the same signing key across restarts.

**How to apply:** Never add a fallback value — the throw is intentional. Generate the secret with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` and store it as a Replit Secret.
