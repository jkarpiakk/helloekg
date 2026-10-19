import type { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";
import { pool } from "../db";
import { storage } from "../storage";

/** UUID-zero dla wpisów audytu bez konkretnej encji (np. nieudane logowanie na nieznany e-mail) */
export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * Pseudonimizowany e-mail do logów/kluczy limitów: HMAC (sekret sesji) z adresu
 * znormalizowanego do małych liter — nie da się go odwrócić słownikiem adresów.
 */
export function hashEmail(email: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET || "helloekg")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_store (
      key        TEXT    PRIMARY KEY,
      count      INTEGER NOT NULL DEFAULT 0,
      reset_time BIGINT  NOT NULL
    )
  `);
  // Periodically clean up expired rows (best-effort, not critical)
  pool.query(
    "DELETE FROM rate_limit_store WHERE reset_time < $1",
    [Date.now()]
  ).catch(() => {});
  tableReady = true;
}

/**
 * PostgreSQL-backed rate limiter.
 * State is shared across all process instances, so limits are correctly
 * enforced in multi-instance deployments without Redis or any new service.
 */
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
  keyPrefix?: string;
}) {
  const {
    windowMs,
    max,
    message = "Zbyt wiele żądań. Spróbuj ponownie później.",
    keyPrefix = "rl",
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await ensureTable();

      const now = Date.now();
      const resetTime = now + windowMs;
      // Use a normalised path (strip query string) as part of the key
      const normPath = req.path.split("?")[0];
      const key = `${keyPrefix}:${req.ip}:${normPath}`;

      const result = await pool.query<{ count: number; reset_time: string }>(
        `INSERT INTO rate_limit_store (key, count, reset_time)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET
           count      = CASE WHEN rate_limit_store.reset_time < $3
                              THEN 1
                              ELSE rate_limit_store.count + 1 END,
           reset_time = CASE WHEN rate_limit_store.reset_time < $3
                              THEN $2
                              ELSE rate_limit_store.reset_time END
         RETURNING count, reset_time`,
        [key, resetTime, now]
      );

      const { count, reset_time } = result.rows[0];
      const retryAfterSec = Math.ceil((Number(reset_time) - now) / 1000);

      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
      res.setHeader("X-RateLimit-Reset", Math.ceil(Number(reset_time) / 1000));

      if (count > max) {
        // Do audytu tylko pierwsze przekroczenie w oknie (bez zalewania tabeli)
        if (count === max + 1) {
          storage
            .createAuditLog({
              actorId: req.session?.userId ?? null,
              action: "rate_limited",
              entityType: "rate_limit",
              entityId: NIL_UUID,
              diff: { limiter: keyPrefix, path: normPath, method: req.method },
              ipAddress: req.ip,
              userAgent: req.get("User-Agent"),
            })
            .catch((e) => console.error("[rateLimit] audit log failed:", e?.message));
        }
        res.setHeader("Retry-After", retryAfterSec);
        return res.status(429).json({ error: message, retryAfter: retryAfterSec });
      }

      next();
    } catch (err) {
      // If the DB is unavailable, fail open to avoid blocking all traffic (logged)
      console.error(`[rateLimit] DB error, failing open (limiter=${keyPrefix}, ip=${req.ip}, path=${req.path}):`, err);
      next();
    }
  };
}

// Limit na adres IP jest celowo luźniejszy: testerzy z jednej sieci (szpital, uczelnia, akademik)
// wychodzą spod wspólnego IP. Konto chroni osobny limit nieudanych logowań na adres e-mail.
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut.",
  keyPrefix: "auth",
});

export const apiRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: "Zbyt wiele żądań API. Spróbuj ponownie za minutę.",
  keyPrefix: "api",
});

export const paymentRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Zbyt wiele prób płatności. Spróbuj ponownie za godzinę.",
  keyPrefix: "pay",
});

// ---------------------------------------------------------------------------
// Limit nieudanych logowań na konto (e-mail) — niezależnie od limitu per IP,
// żeby rozproszony atak (wiele IP) na jedno konto też był hamowany.
// ---------------------------------------------------------------------------
const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAIL_MAX = 10;
const loginFailKey = (email: string) => `loginfail:${hashEmail(email)}`;

/** Zwraca liczbę sekund do odblokowania, jeśli konto jest chwilowo zablokowane; inaczej null. */
export async function loginEmailBlockedFor(email: string): Promise<number | null> {
  try {
    await ensureTable();
    const now = Date.now();
    const r = await pool.query<{ count: number; reset_time: string }>(
      "SELECT count, reset_time FROM rate_limit_store WHERE key = $1",
      [loginFailKey(email)]
    );
    const row = r.rows[0];
    if (!row || Number(row.reset_time) < now || row.count < LOGIN_FAIL_MAX) return null;
    return Math.ceil((Number(row.reset_time) - now) / 1000);
  } catch (err) {
    console.error("[rateLimit] login email check failed, failing open:", err);
    return null;
  }
}

export async function recordLoginFailure(email: string): Promise<void> {
  try {
    await ensureTable();
    const now = Date.now();
    await pool.query(
      `INSERT INTO rate_limit_store (key, count, reset_time)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count      = CASE WHEN rate_limit_store.reset_time < $3 THEN 1 ELSE rate_limit_store.count + 1 END,
         reset_time = CASE WHEN rate_limit_store.reset_time < $3 THEN $2 ELSE rate_limit_store.reset_time END`,
      [loginFailKey(email), now + LOGIN_FAIL_WINDOW_MS, now]
    );
  } catch (err) {
    console.error("[rateLimit] recording login failure failed:", err);
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  try {
    await pool.query("DELETE FROM rate_limit_store WHERE key = $1", [loginFailKey(email)]);
  } catch (err) {
    console.error("[rateLimit] clearing login failures failed:", err);
  }
}

/** Usunięcie konta — osobny limit i komunikat, który mówi o tym, co się dzieje */
export const accountDeleteRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Zbyt wiele prób usunięcia konta. Spróbuj ponownie za 15 minut.",
  keyPrefix: "account-delete",
});
