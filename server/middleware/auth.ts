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

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Błąd serwera" });
  }
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

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Wymagane uwierzytelnienie" });
  }

  // Allow admins to bypass subscription check
  if (["owner", "admin", "reviewer", "support"].includes(req.user.role)) {
    return next();
  }

  try {
    const subscription = await storage.getUserActiveSubscription(req.user.id);
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
