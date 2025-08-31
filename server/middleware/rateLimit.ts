import type { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
}) {
  const { windowMs, max, message = "Zbyt wiele żądań. Spróbuj ponownie później." } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }

    store[key].count++;

    if (store[key].count > max) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000)
      });
    }

    next();
  };
}

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: "Zbyt wiele prób logowania. Spróbuj ponownie za 15 minut."
});

export const apiRateLimit = createRateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: "Zbyt wiele żądań API. Spróbuj ponownie za minutę."
});
