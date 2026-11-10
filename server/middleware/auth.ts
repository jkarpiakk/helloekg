import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

export const ACCOUNT_SUSPENDED_MESSAGE = "Konto zawieszone. Napisz do nas: kontakt@helloekg.pl";
export const EMAIL_NOT_VERIFIED_MESSAGE = "Potwierdź adres e-mail linkiem z wiadomości, którą wysłaliśmy po rejestracji.";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Wymagane uwierzytelnienie" });
  }

  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Nieprawidłowa sesja" });
    }

    if (user.suspendedAt) {
      req.session.destroy(() => {});
      return res.status(403).json({ error: ACCOUNT_SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
}

/**
 * Treść kursu (wykłady, pytania, postęp, grafiki) tylko dla potwierdzonego adresu e-mail.
 * Stawiać po requireAuth. Niepotwierdzone konto może się zalogować, ale widzi tylko ekran „potwierdź e-mail”.
 */
export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Wymagane uwierzytelnienie" });
  if (!req.user.emailVerified) {
    return res.status(403).json({ error: EMAIL_NOT_VERIFIED_MESSAGE, code: "EMAIL_NOT_VERIFIED" });
  }
  next();
}

/** Zalogowane konto z potwierdzonym adresem: warunek każdej treści kursu (requireAuth, potem requireVerified) */
export function requireKonto(req: Request, res: Response, next: NextFunction) {
  void requireAuth(req, res, (err?: unknown) => (err ? next(err) : requireVerified(req, res, next)));
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Wymagane uwierzytelnienie" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Brak uprawnień" });
    }

    next();
  };
}

export const requireAdmin = requireRole(["owner", "admin"]);
export const requireReviewer = requireRole(["owner", "reviewer"]);
export const requireSupport = requireRole(["owner", "support", "admin"]);
export const requireOwner = requireRole(["owner"]);
// Ręczne nadawanie/odbieranie dostępu (bez płatności) — tylko właściciel i support
export const requireSubscriptionManager = requireRole(["owner", "support"]);

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Wymagane uwierzytelnienie" });
  }

  // Allow admins to bypass subscription check
  if (["owner", "admin", "reviewer", "support"].includes(req.user.role)) {
    return next();
  }

  try {
    const subscription = await storage.getUserActiveSubscription(req.user.id, req.user);
    if (!subscription) {
      return res.status(403).json({ 
        error: "Wymagana aktywna subskrypcja",
        code: "SUBSCRIPTION_REQUIRED"
      });
    }

    next();
  } catch (error) {
    console.error("Subscription check error:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
}
