import type { Request, Response, NextFunction } from "express";
import { pool } from "../db";

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
        res.setHeader("Retry-After", retryAfterSec);
        return res.status(429).json({ error: message, retryAfter: retryAfterSec });
      }

      next();
    } catch (err) {
      // If the DB is unavailable, fail open to avoid blocking all traffic
      console.error("[rateLimit] DB error, failing open:", err);
      next();
    }
  };
}

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
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
