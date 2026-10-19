import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { storage } from "./storage";
import { authService } from "./auth";
import { emailService, esc } from "./services/emailService";
import { quizService } from "./services/quizService";
import { certificateService } from "./services/certificateService";
import * as gamificationService from "./services/gamificationService";
import {
  requireAuth,
  requireAdmin,
  requireReviewer,
  requireOwner,
  requireSubscriptionManager,
  requireActiveSubscription,
  ACCOUNT_SUSPENDED_MESSAGE,
} from "./middleware/auth";
import {
  authRateLimit,
  accountDeleteRateLimit,
  apiRateLimit,
  paymentRateLimit,
  hashEmail,
  NIL_UUID,
  loginEmailBlockedFor,
  recordLoginFailure,
  clearLoginFailures,
} from "./middleware/rateLimit";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  insertQuestionSchema,
  insertBlogPostSchema,
  insertDemoQuestionSchema,
  insertHomePageContentSchema,
  BlogPost,
  InsertBlogPost,
  PASSWORD_MAX_LENGTH,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { users, modules, sections, questions, attempts, progress, subscriptions, plans, certificates, auditLog, supportTickets, lectureChapters, blogPosts } from "@shared/schema";
import { eq, or, and, gte, desc, count, ilike, avg, sql, isNull, isNotNull } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";

// Blog validation schemas
const blogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  tag: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(['draft', 'published']).optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(['draft', 'published'])
});

// ── Role i zarządzanie kontami ─────────────────────────────────────────────
const USER_ROLES = ["owner", "admin", "reviewer", "support", "student"] as const;
// Role, które może nadawać/odbierać wyłącznie właściciel
const PRIVILEGED_ROLES: readonly string[] = ["owner", "admin"];

const adminCreateUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(PASSWORD_MAX_LENGTH),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(USER_ROLES).default("student"),
});

const adminUpdateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  // "suspended" zawiesza; "verified" potwierdza e-mail i zdejmuje zawieszenie; "active" tylko zdejmuje zawieszenie
  status: z.enum(["verified", "suspended", "active"]).optional(),
});

const adminSubscriptionSchema = z.object({
  action: z.enum(["grant", "revoke"]),
  durationMonths: z.coerce.number().int().min(1).max(24).default(1),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

const REGISTER_MESSAGE = "Konto zostało utworzone. Sprawdź e-mail w celu weryfikacji.";

/** Dane użytkownika zwracane po zalogowaniu/rejestracji (bez pól wrażliwych) */
function sessionUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    locale: user.locale,
    emailVerified: user.emailVerified,
  };
}

/** Użytkownik w panelu admina — bez haseł, tokenów i identyfikatorów Stripe */
function adminUserView(user: User) {
  const {
    password: _pw,
    emailVerificationToken: _evt,
    passwordResetToken: _prt,
    passwordResetExpiry: _pre,
    stripeCustomerId: _sc,
    stripeSubscriptionId: _ss,
    ...safe
  } = user;
  return safe;
}

/** Nowa sesja dla użytkownika (regenerate chroni przed session fixation) */
function establishSession(req: import("express").Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

/** Audyt „best effort” — błąd zapisu nie psuje odpowiedzi */
function auditSafe(entry: Parameters<typeof storage.createAuditLog>[0]) {
  storage.createAuditLog(entry).catch((e) => console.error("[audit] write failed:", e?.message));
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Replit environment
  app.set('trust proxy', 1);

  // ── Health / readiness endpoints ──────────────────────────────────────────
  // These are intentionally placed BEFORE session, auth, and rate-limit
  // middleware so they are always fast and always reachable.

  // Liveness: the process is alive
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Readiness: process is alive AND can reach the database.
  // Uses storage.getActivePlans() — the same Drizzle path proven by /api/plans.
  app.get("/ready", async (_req, res) => {
    try {
      await storage.getActivePlans();
      res.status(200).json({ status: "ok", db: "ok" });
    } catch (err: any) {
      console.error("[ready] DB check failed:", err.message);
      res.status(503).json({ status: "error", db: "unavailable" });
    }
  });

  // (Usunięto publiczny katalog /attached_assets — klient importuje te pliki przez @assets, Vite je pakuje.)

  // Session configuration
  const PgSession = connectPg(session);
  app.use(session({
    store: process.env.DATABASE_URL ? new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session',
      createTableIfMissing: true,
    }) : (() => {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('DATABASE_URL is required in production for persistent sessions');
      }
      console.warn('WARNING: No DATABASE_URL — using in-memory session store. Sessions will not survive restarts.');
      return undefined;
    })(),
    secret: (() => {
      const s = process.env.SESSION_SECRET;
      if (!s) {
        throw new Error(
          "FATAL: SESSION_SECRET is not set.\n" +
          "Add it in the Replit Secrets tab (padlock icon in the sidebar).\n" +
          "Generate a value with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
        );
      }
      return s;
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    }
  }));

  // Apply rate limiting to all API routes
  app.use('/api', apiRateLimit);

  // Auth endpoints
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Only email + password required; fill in defaults for remaining required DB fields
      const userDataFixed = {
        email: userData.email,
        password: userData.password,
        firstName: "",
        lastName: "",
        marketingConsent: userData.marketingConsent ?? false,
        termsAccepted: userData.termsAccepted ?? false,
        privacyAccepted: userData.privacyAccepted ?? false,
      };

      let user: User;
      let verificationToken: string;
      try {
        ({ user, verificationToken } = await authService.registerUser(userDataFixed));
      } catch (err: any) {
        if (err.message?.includes("już istnieje")) {
          // Ten sam status i komunikat co przy nowym koncie, bez danych konta i bez sesji.
          return res.status(201).json({ message: REGISTER_MESSAGE });
        }
        throw err;
      }

      const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:5000"}/verify-email?token=${verificationToken}`;
      try {
        await emailService.sendEmailVerification(user.email, user.firstName, verificationUrl);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
      }

      auditSafe({
        actorId: user.id,
        action: "user_registered",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Od razu zalogowany — klient może przejść prosto do /dashboard
      try {
        await establishSession(req, user.id);
      } catch (sessionErr) {
        console.error("Session after registration error:", sessionErr);
        return res.status(201).json({ message: REGISTER_MESSAGE });
      }

      res.status(201).json({ message: REGISTER_MESSAGE, user: sessionUser(user) });
    } catch (error: any) {
      console.error("Registration error:", error.message);
      res.status(400).json({ error: "Błąd podczas rejestracji" });
    }
  });

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    let email: string;
    let password: string;
    try {
      ({ email, password } = loginSchema.parse(req.body));
    } catch {
      return res.status(400).json({ error: "Błąd podczas logowania" });
    }

    try {
      // Limit nieudanych prób na konto (niezależnie od limitu per IP)
      const blockedFor = await loginEmailBlockedFor(email);
      if (blockedFor) {
        auditSafe({
          actorId: null,
          action: "rate_limited",
          entityType: "auth",
          entityId: NIL_UUID,
          diff: { limiter: "login_email", emailHash: hashEmail(email) },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        res.setHeader("Retry-After", blockedFor);
        return res.status(429).json({
          error: "Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.",
          retryAfter: blockedFor,
        });
      }

      const user = await authService.authenticateUser(email, password);
      if (!user) {
        await recordLoginFailure(email);
        auditSafe({
          actorId: null,
          action: "login_failed",
          entityType: "auth",
          entityId: NIL_UUID,
          diff: { emailHash: hashEmail(email) },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        return res.status(401).json({ error: "Nieprawidłowe dane logowania" });
      }

      // Zawieszenie sprawdzamy dopiero po poprawnym haśle (nie zdradza stanu konta obcym)
      if (user.suspendedAt) {
        auditSafe({
          actorId: user.id,
          action: "login_blocked_suspended",
          entityType: "user",
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        return res.status(403).json({ error: ACCOUNT_SUSPENDED_MESSAGE, code: "ACCOUNT_SUSPENDED" });
      }

      await clearLoginFailures(email);

      // Regenerate session ID before storing credentials (prevents session fixation)
      try {
        await establishSession(req, user.id);
      } catch (sessionErr) {
        console.error("Session error:", sessionErr);
        return res.status(500).json({ error: "Błąd sesji" });
      }

      auditSafe({
        actorId: user.id,
        action: "user_login",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ user: sessionUser(user) });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Błąd podczas logowania" });
    }
  });

  // Email verification endpoint
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Brak tokenu weryfikacyjnego" });
      }

      const user = await authService.verifyEmail(token);
      
      if (!user) {
        return res.status(400).json({ error: "Nieprawidłowy lub wygasły token weryfikacyjny" });
      }

      await storage.createAuditLog({
        actorId: user.id,
        action: "email_verified",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ 
        success: true, 
        message: "Adres e-mail został zweryfikowany. Możesz się teraz zalogować." 
      });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ error: "Błąd podczas weryfikacji e-maila" });
    }
  });

  // Resend verification email
  app.post("/api/auth/resend-verification", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body ?? {};
      
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Podaj adres e-mail" });
      }

      // Ta sama odpowiedź niezależnie od tego, czy konto istnieje / jest już zweryfikowane
      const genericResponse = { message: "Jeśli konto istnieje i nie jest jeszcze zweryfikowane, wysłaliśmy nowy link weryfikacyjny" };

      const user = await storage.getUserByEmail(email);
      if (!user || user.emailVerified) {
        return res.json(genericResponse);
      }

      // Generate new token
      const newToken = authService.generateToken();
      await storage.updateUser(user.id, { emailVerificationToken: newToken });

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify-email?token=${newToken}`;
      
      try {
        await emailService.sendEmailVerification(user.email, user.firstName, verificationUrl);
      } catch (emailError) {
        console.error("Failed to resend verification email:", emailError);
      }

      res.json(genericResponse);
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Błąd podczas wysyłania e-maila" });
    }
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Podaj prawidłowy adres e-mail" });
      }

      const { email } = parsed.data;
      const resetToken = await authService.initiatePasswordReset(email);

      auditSafe({
        actorId: null,
        action: "password_reset_requested",
        entityType: "auth",
        entityId: NIL_UUID,
        diff: { emailHash: hashEmail(email), accountExists: !!resetToken },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      if (resetToken) {
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;
        try {
          const user = await storage.getUserByEmail(email);
          if (user) {
            await emailService.sendPasswordReset(user.email, user.firstName, resetUrl);
          }
        } catch (emailError) {
          console.error("Failed to send password reset email:", emailError);
        }
      }

      res.json({ message: "Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła" });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Wystąpił błąd. Spróbuj ponownie później" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Nieprawidłowe dane. Hasło musi mieć co najmniej 8 znaków" });
      }

      const { token, password } = parsed.data;
      const result = await authService.resetPassword(token, password);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      if (result.userId) {
        await storage.createAuditLog({
          actorId: result.userId,
          action: "password_reset",
          entityType: "user",
          entityId: result.userId,
        });
        // Sessions are already invalidated inside authService.resetPassword
      }

      res.json({ message: "Hasło zostało zmienione. Możesz się teraz zalogować" });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Wystąpił błąd. Spróbuj ponownie później" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Błąd podczas wylogowania" });
      }
      res.json({ message: "Wylogowano pomyślnie" });
    });
  });

  // Usunięcie konta: JSON { password } — wymagane bieżące hasło
  app.delete("/api/auth/account", accountDeleteRateLimit, requireAuth, async (req, res) => {
    const parsed = deleteAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Podaj hasło, aby potwierdzić usunięcie konta" });
    }

    try {
      const userId = req.user!.id;
      const userEmail = req.user!.email;
      const userFirstName = req.user!.firstName;

      const passwordOk = await authService.verifyPassword(parsed.data.password, req.user!.password);
      if (!passwordOk) {
        auditSafe({
          actorId: userId,
          action: "account_delete_failed_password",
          entityType: "user",
          entityId: userId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
        return res.status(403).json({ error: "Nieprawidłowe hasło" });
      }

      // Wszystko albo nic: audyt, anonimizacja zgłoszeń, sesje, konto
      await db.transaction(async (tx) => {
        await tx.update(subscriptions)
          .set({ status: "cancelled", endDate: new Date() })
          .where(and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active")
          ));

        // Zgłoszenia zostają (historia supportu), ale bez danych osobowych
        await tx.update(supportTickets)
          .set({ userEmail: "usuniete-konto@helloekg.invalid", userName: "Usunięte konto", userId: null })
          .where(or(eq(supportTickets.userId, userId), eq(supportTickets.userEmail, userEmail)));

        // actor_id zostanie wyzerowany przez ON DELETE SET NULL
        await tx.insert(auditLog).values({
          actorId: userId,
          action: "account_deleted",
          entityType: "user",
          entityId: userId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });

        await tx.execute(sql`DELETE FROM session WHERE sess::jsonb->>'userId' = ${userId}`);
        await tx.delete(users).where(eq(users.id, userId));
      });

      try {
        await emailService.sendEmail(userEmail, {
          subject: "Potwierdzenie usunięcia konta — helloEKG",
          html: `<p>Cześć ${esc(userFirstName || '')},</p><p>Twoje konto w helloEKG zostało usunięte zgodnie z Twoim żądaniem. Wszystkie Twoje dane osobowe zostały trwale usunięte z naszych systemów.</p><p>Zespół helloEKG</p>`,
          text: "Twoje konto w helloEKG zostało usunięte zgodnie z Twoim żądaniem. Wszystkie Twoje dane osobowe zostały trwale usunięte z naszych systemów."
        });
      } catch (emailError) {
        console.error("Failed to send account deletion confirmation email:", emailError);
      }

      req.session.destroy(() => {});
      res.clearCookie("connect.sid");

      res.json({ message: "Konto zostało usunięte zgodnie z życzeniem." });
    } catch (error: any) {
      console.error("Account deletion error:", error);
      // 23503 = FK: konto zespołu z autorstwem treści (pytania, rozdziały) — nie da się usunąć samoobsługowo
      if (error?.code === "23503" || error?.cause?.code === "23503") {
        return res.status(409).json({ error: "Tego konta nie można usunąć samodzielnie — napisz do nas: kontakt@helloekg.pl" });
      }
      res.status(500).json({ error: "Błąd podczas usuwania konta" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        firstName: req.user!.firstName,
        lastName: req.user!.lastName,
        role: req.user!.role,
        locale: req.user!.locale
      }
    });
  });

  // Subscription and payment endpoints
  app.get("/api/plans", async (req, res) => {
    try {
      const plans = await storage.getActivePlans();
      res.json(plans);
    } catch (error) {
      console.error("Plans fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania planów" });
    }
  });

  app.get("/api/subscription/status", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getUserActiveSubscription(req.user!.id);
      if (!subscription) {
        return res.json({ hasActiveSubscription: false, subscription: null });
      }
      res.json({
        hasActiveSubscription: true,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: subscription.status,
          paymentProvider: subscription.paymentProvider,
        },
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statusu subskrypcji" });
    }
  });

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Stripe config error:", error);
      res.status(500).json({ error: "Stripe nie jest skonfigurowany" });
    }
  });

  // Guest checkout - create account and checkout in one step
  app.post("/api/stripe/guest-checkout", paymentRateLimit, async (req, res) => {
    try {
      const { email, planId } = req.body;
      
      if (!email || !planId) {
        return res.status(400).json({ error: "Email i plan są wymagane" });
      }

      const plan = await storage.getActivePlans().then(plans => 
        plans.find(p => p.id === planId)
      );
      
      if (!plan) {
        return res.status(404).json({ error: "Plan nie znaleziony" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Check if user exists
      let user = await storage.getUserByEmail(email);
      let customerId: string | undefined;
      
      if (user) {
        // User exists - use their Stripe customer or create one
        if (user.stripeCustomerId) {
          customerId = user.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email: user.email,
            name: user.firstName ? `${user.firstName} ${user.lastName}` : email,
            metadata: { userId: user.id }
          });
          customerId = customer.id;
          await storage.updateUserStripeCustomerId(user.id, customer.id);
        }
      } else {
        // New guest - create account FIRST so the webhook can activate the
        // subscription even if the browser is closed after payment.
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const passwordHash = await bcrypt.hash(randomPassword, 12);

        let newUser;
        try {
          newUser = await storage.createUser({
            email,
            password: passwordHash,
            firstName: email.split('@')[0],
            lastName: '',
            emailVerified: true,
            role: 'student'
          });

          await storage.createAuditLog({
            actorId: newUser.id,
            action: 'user_registered_via_guest_checkout',
            entityType: 'user',
            entityId: newUser.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          });
        } catch (createError) {
          // Race: a concurrent request may have created this account first.
          // Fall back to the existing user instead of returning a false 500.
          const existing = await storage.getUserByEmail(email);
          if (!existing) throw createError;
          newUser = existing;
        }

        user = newUser;

        if (newUser.stripeCustomerId) {
          customerId = newUser.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email: email,
            metadata: { userId: newUser.id }
          });
          customerId = customer.id;
          await storage.updateUserStripeCustomerId(newUser.id, customer.id);
        }
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: `Dostęp na ${plan.durationDays} dni`,
            },
            unit_amount: Math.round(parseFloat(plan.price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/?payment=cancelled`,
        metadata: {
          email: email,
          planId: plan.id,
          durationDays: plan.durationDays.toString(),
          userId: user.id
        }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Guest checkout error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia sesji płatności" });
    }
  });

  // Finalize payment - auto-create account for guests
  app.post("/api/stripe/finalize-payment", paymentRateLimit, async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Brak ID sesji" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Płatność nie została zrealizowana" });
      }

      const { email, planId, durationDays, userId, isGuest } = session.metadata || {};
      
      if (!email || !planId) {
        return res.status(400).json({ error: "Brakujące dane sesji" });
      }

      let user;
      let isNewAccount = false;
      
      // Check if user already exists or was created
      if (userId && userId !== '') {
        user = await storage.getUser(userId);
      }
      
      if (!user) {
        // Check by email
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        // Create new account for guest - generate random password
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 12);
        
        const [newUser] = await db.insert(users).values({
          email: email,
          password: hashedPassword,
          firstName: '',
          lastName: '',
          role: 'student',
          emailVerified: true, // Auto-verify since they paid
          stripeCustomerId: session.customer as string || undefined,
        }).returning();
        
        user = newUser;
        isNewAccount = true;
        
        // Create audit log
        await storage.createAuditLog({
          actorId: user.id,
          action: "user_registered_via_payment",
          entityType: "user",
          entityId: user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      // Check if subscription already exists
      const existingSubscription = await storage.getUserActiveSubscription(user.id);
      let subscription;
      
      if (!existingSubscription) {
        // Create subscription
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parseInt(durationDays || '30'));

        subscription = await storage.createSubscription({
          userId: user.id,
          planId,
          startDate,
          endDate,
          status: "active",
          paymentProvider: "stripe"
        });

        // Send confirmation email
        const plan = await storage.getActivePlans().then(plans => 
          plans.find(p => p.id === planId)
        );
        
        if (plan) {
          try {
            await emailService.sendSubscriptionConfirmation(
              user.email,
              user.firstName || 'Użytkowniku',
              plan.name,
              endDate.toLocaleDateString('pl-PL')
            );
          } catch (emailError) {
            console.error("Failed to send subscription email:", emailError);
          }
        }
      } else {
        subscription = existingSubscription;
      }

      res.json({
        success: true,
        isNewAccount,
        email: user.email,
        subscription: {
          startDate: subscription.startDate,
          endDate: subscription.endDate
        }
      });
    } catch (error: any) {
      console.error("Finalize payment error:", error);
      res.status(500).json({ error: "Błąd podczas finalizacji płatności" });
    }
  });

  // Create Stripe Checkout session
  app.post("/api/stripe/checkout", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;
      
      const plan = await storage.getActivePlans().then(plans => 
        plans.find(p => p.id === planId)
      );
      
      if (!plan) {
        return res.status(404).json({ error: "Plan nie znaleziony" });
      }

      const stripe = await getUncachableStripeClient();
      
      // Create or get Stripe customer
      let customerId: string | undefined;
      const user = await storage.getUser(req.user!.id);
      
      if (user?.stripeCustomerId) {
        customerId = user.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: req.user!.email,
          name: `${req.user!.firstName} ${req.user!.lastName}`,
          metadata: { userId: req.user!.id }
        });
        customerId = customer.id;
        await storage.updateUserStripeCustomerId(req.user!.id, customer.id);
      }

      // Create checkout session with one-time payment
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: {
              name: plan.name,
              description: `Dostęp na ${plan.durationDays} dni`,
            },
            unit_amount: Math.round(parseFloat(plan.price) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/?payment=cancelled`,
        metadata: {
          userId: req.user!.id,
          planId: plan.id,
          durationDays: plan.durationDays.toString()
        }
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia sesji płatności" });
    }
  });

  // Handle successful payment (called after checkout.session.completed webhook)
  app.post("/api/stripe/payment-success", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ error: "Brak ID sesji" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === 'paid' && session.metadata) {
        const { userId, planId, durationDays } = session.metadata;
        
        if (userId === req.user!.id) {
          // Check if subscription was already created by webhook (idempotency)
          const existingSubscription = await storage.getUserActiveSubscription(userId);
          if (existingSubscription) {
            console.log(`Subscription already exists for user ${userId}, skipping creation`);
            return res.json({ 
              success: true, 
              subscription: { 
                startDate: existingSubscription.startDate, 
                endDate: existingSubscription.endDate 
              } 
            });
          }

          const plan = await storage.getActivePlans().then(plans => 
            plans.find(p => p.id === planId)
          );

          if (plan) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + parseInt(durationDays || plan.durationDays.toString()));

            await storage.createSubscription({
              userId,
              planId,
              startDate,
              endDate,
              status: "active",
              paymentProvider: "stripe"
            });

            // Send confirmation email via SendGrid
            const user = await storage.getUser(userId);
            if (user) {
              try {
                await emailService.sendSubscriptionConfirmation(
                  user.email,
                  user.firstName,
                  plan.name,
                  endDate.toLocaleDateString('pl-PL')
                );
              } catch (emailError) {
                console.error("Failed to send subscription email:", emailError);
              }
            }

            return res.json({ success: true, subscription: { startDate, endDate } });
          }
        }
      }

      res.status(400).json({ error: "Płatność nie została zrealizowana" });
    } catch (error) {
      console.error("Payment success error:", error);
      res.status(500).json({ error: "Błąd podczas przetwarzania płatności" });
    }
  });

  // Quiz endpoints
  // Get modules with sections and user progress
  app.get("/api/modules", requireAuth, async (req, res) => {
    try {
      let allModules = await storage.getModules();
      const userProgress = await storage.getUserProgress(req.user!.id);
      
      // Filter hidden modules for non-admin users
      const isAdmin = ["owner", "admin", "reviewer"].includes(req.user!.role);
      if (!isAdmin) {
        allModules = allModules.filter(m => m.isVisible !== false);
      }
      
      // Check if user has active subscription
      const subscription = await storage.getUserActiveSubscription(req.user!.id);
      const hasActiveSubscription = subscription && new Date(subscription.endDate) > new Date();
      
      // If no active subscription, only show demo module
      if (!hasActiveSubscription && !isAdmin) {
        allModules = allModules.filter(m => m.title.toLowerCase().includes('demo'));
      }
      
      // Liczba opublikowanych rozdziałów i pytań w sekcjach — interfejs pokazuje,
      // co naprawdę jest w sekcji (wykład, pytania albo jedno i drugie)
      const [questionCounts, chapterCounts] = await Promise.all([
        db.select({ sectionId: questions.sectionId, n: count() }).from(questions)
          .where(eq(questions.status, "published")).groupBy(questions.sectionId),
        db.select({ sectionId: lectureChapters.sectionId, n: count() }).from(lectureChapters)
          .where(eq(lectureChapters.isPublished, true)).groupBy(lectureChapters.sectionId),
      ]);
      const qBySection = new Map(questionCounts.map((r) => [r.sectionId, Number(r.n)]));
      const chBySection = new Map(chapterCounts.map((r) => [r.sectionId, Number(r.n)]));

      // Build modules with sections and progress
      const modulesWithSections = await Promise.all(
        allModules.map(async (module) => {
          let sections = await storage.getSectionsByModule(module.id);
          
          // Filter hidden sections for non-admin users
          if (!isAdmin) {
            sections = sections.filter(s => s.isVisible !== false);
          }
          
          // Add progress to each section
          const sectionsWithProgress = sections.map(section => {
            const progress = userProgress.find(p => p.sectionId === section.id);
            return {
              ...section,
              completionPercentage: progress ? parseFloat(progress.completionPercentage) : 0,
              lastActivity: progress?.lastActivity,
              questionCount: qBySection.get(section.id) ?? 0,
              chapterCount: chBySection.get(section.id) ?? 0,
            };
          });
          
          // Calculate module completion percentage
          // Postęp liczymy z odpowiedzi, więc tylko sekcje, które mają pytania —
          // inaczej sekcje z samym wykładem trzymałyby moduł wiecznie poniżej 100%
          const gradable = sectionsWithProgress.filter((s) => s.questionCount > 0);
          const moduleCompletion = gradable.length > 0
            ? gradable.reduce((acc, section) => acc + (section.completionPercentage || 0), 0) / gradable.length
            : 0;
          
          return {
            ...module,
            sections: sectionsWithProgress,
            completionPercentage: moduleCompletion
          };
        })
      );
      
      res.json(modulesWithSections);
    } catch (error) {
      console.error("Modules fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania modułów" });
    }
  });

  // Get sections with user progress (legacy endpoint)
  app.get("/api/sections", requireAuth, async (req, res) => {
    try {
      let allSections = await storage.getSections();
      const userProgress = await storage.getUserProgress(req.user!.id);
      
      // Filter hidden sections for non-admin users
      const isAdmin = ["owner", "admin", "reviewer"].includes(req.user!.role);
      if (!isAdmin) {
        allSections = allSections.filter(s => s.isVisible !== false);
      }
      
      // Check if user has active subscription
      const subscription = await storage.getUserActiveSubscription(req.user!.id);
      const hasActiveSubscription = subscription && new Date(subscription.endDate) > new Date();
      
      // If no active subscription, only show sections from demo modules
      if (!hasActiveSubscription && !isAdmin) {
        // Get demo module IDs
        const allModules = await storage.getModules();
        const demoModuleIds = allModules
          .filter(m => m.title.toLowerCase().includes('demo'))
          .map(m => m.id);
        allSections = allSections.filter(s => demoModuleIds.includes(s.moduleId));
      }
      
      const sectionsWithProgress = allSections.map(section => {
        const progress = userProgress.find(p => p.sectionId === section.id);
        return {
          ...section,
          completionPercentage: progress ? parseFloat(progress.completionPercentage) : 0,
          lastActivity: progress?.lastActivity
        };
      });

      res.json(sectionsWithProgress);
    } catch (error) {
      console.error("Sections fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania sekcji" });
    }
  });

  app.get("/api/quiz/question", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sectionId, mode = "learn", exclude, ids } = req.query;
      const list = (v: unknown) => (typeof v === "string" && v ? v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100) : undefined);
      
      // For review mode, sectionId is optional (uses review queue)
      if (!sectionId && mode !== "review") {
        return res.status(400).json({ error: "sectionId jest wymagane" });
      }

      const question = await quizService.getQuestionForUser(
        req.user!.id,
        sectionId as string || null,
        mode as any,
        { exclude: list(exclude), ids: list(ids) }
      );

      if (!question) {
        return res.status(404).json({ error: "Brak dostępnych pytań" });
      }

      res.json(question);
    } catch (error) {
      console.error("Question fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytania" });
    }
  });

  // Exam endpoints
  app.post("/api/exam/initialize", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { count } = req.body;
      
      if (typeof count !== 'number' || count <= 0) {
        return res.status(400).json({ error: "Nieprawidłowa liczba pytań" });
      }

      const session = await quizService.initializeExam(req.user!.id, count);
      res.json(session);
    } catch (error: any) {
      console.error("Exam initialization error:", error);
      res.status(500).json({ error: "Błąd podczas inicjalizacji egzaminu" });
    }
  });

  app.get("/api/exam/question", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sessionId, index } = req.query;
      
      if (!sessionId || typeof index !== 'string') {
        return res.status(400).json({ error: "sessionId i index są wymagane" });
      }

      const questionIndex = parseInt(index);
      const question = await quizService.getExamQuestion(sessionId as string, questionIndex, req.user!.id);

      if (!question) {
        return res.status(404).json({ error: "Brak dostępnych pytań" });
      }

      res.json(question);
    } catch (error: any) {
      console.error("Exam question fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytania" });
    }
  });

  app.post("/api/exam/answer", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sessionId, questionId, selectedIndex, timeMs, answerData } = req.body;

      if (!sessionId || typeof questionId !== 'string' || typeof timeMs !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane" });
      }

      // For interactive question types, answerData is required
      // For multiple choice, selectedIndex is required
      if (answerData === undefined && typeof selectedIndex !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane odpowiedzi" });
      }

      const result = await quizService.submitExamAnswer(
        sessionId,
        questionId,
        selectedIndex ?? -1,
        timeMs,
        req.user!.id,
        answerData
      );

      res.json(result);
    } catch (error: any) {
      console.error("Exam answer submission error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zapisywania odpowiedzi" });
    }
  });

  app.get("/api/exam/summary", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sessionId } = req.query;
      
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId jest wymagane" });
      }

      const summary = await quizService.getExamSummary(sessionId as string, req.user!.id);

      if (!summary) {
        return res.status(404).json({ error: "Sesja egzaminu nie znaleziona" });
      }

      res.json(summary);
    } catch (error: any) {
      console.error("Exam summary error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania podsumowania" });
    }
  });

  app.post("/api/quiz/answer", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { questionId, selectedIndex, timeMs, mode = "learn", answerData } = req.body;

      if (typeof questionId !== 'string' || typeof timeMs !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane" });
      }

      // For interactive question types, answerData is required
      // For multiple choice, selectedIndex is required
      if (answerData === undefined && typeof selectedIndex !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane odpowiedzi" });
      }

      const result = await quizService.submitAnswer(
        req.user!.id,
        questionId,
        selectedIndex ?? -1,
        timeMs,
        mode,
        answerData
      );

      // Przyznaj XP i aktualizuj streak po każdej odpowiedzi
      const gamificationResult = await gamificationService.handleQuestionAnswer(
        req.user!.id,
        result.isCorrect,
        timeMs
      );

      res.json({
        ...result,
        gamification: gamificationResult
      });
    } catch (error: any) {
      console.error("Answer submission error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zapisywania odpowiedzi" });
    }
  });

  app.get("/api/progress", requireAuth, async (req, res) => {
    try {
      const progress = await storage.getUserProgress(req.user!.id);
      const stats = await storage.getUserStatistics(req.user!.id);
      const weakAreas = await quizService.getUserWeakAreas(req.user!.id);

      res.json({
        progress,
        stats,
        weakAreas
      });
    } catch (error) {
      console.error("Progress fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania postępu" });
    }
  });

  app.get("/api/review-queue", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const reviewQuestions = await quizService.getReviewQueue(req.user!.id);
      res.json({ questionIds: reviewQuestions });
    } catch (error) {
      console.error("Review queue error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania kolejki powtórek" });
    }
  });

  // Certificate endpoints
  app.get("/api/certificates/eligibility", requireAuth, async (req, res) => {
    try {
      const isEligible = await certificateService.isEligibleForCertificate(req.user!.id);
      const userStats = await storage.getUserStatistics(req.user!.id);
      const progress = await storage.getUserProgress(req.user!.id);
      const sections = await storage.getSections();
      
      const completedModules = progress.filter(p => parseFloat(p.completionPercentage) >= 100).length;
      const totalModules = sections.length;
      
      res.json({
        isEligible,
        successRate: userStats.successRate,
        completedModules,
        totalModules,
        requiredSuccessRate: 0.8,
        requiredModules: totalModules
      });
    } catch (error) {
      console.error("Certificate eligibility error:", error);
      res.status(500).json({ error: "Błąd podczas sprawdzania uprawnień" });
    }
  });

  app.get("/api/certificates/my", requireAuth, async (req, res) => {
    try {
      const certificates = await storage.getUserCertificates(req.user!.id);
      res.json(certificates);
    } catch (error) {
      console.error("My certificates error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania certyfikatów" });
    }
  });

  app.post("/api/certificates/generate", requireAuth, async (req, res) => {
    try {
      const result = await certificateService.generateCertificate(req.user!.id);
      res.json(result);
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas generowania certyfikatu" });
    }
  });

  app.get("/api/certificates/verify/:certificateId", async (req, res) => {
    try {
      const { certificateId } = req.params;
      const verification = await certificateService.verifyCertificate(certificateId);
      
      if (!verification) {
        return res.status(404).json({ error: "Certyfikat nie znaleziony" });
      }

      res.json(verification);
    } catch (error) {
      console.error("Certificate verification error:", error);
      res.status(500).json({ error: "Błąd podczas weryfikacji certyfikatu" });
    }
  });

  // ====== GAMIFICATION ENDPOINTS ======
  
  // Pobierz statystyki użytkownika (XP, poziom, streak)
  app.get("/api/gamification/stats", requireAuth, async (req, res) => {
    try {
      const stats = await gamificationService.getUserStats(req.user!.id);
      const levelInfo = gamificationService.getXpToNextLevel(stats.xp, stats.level);
      const levelName = gamificationService.getLevelName(stats.level);
      
      res.json({
        ...stats,
        levelName,
        levelInfo
      });
    } catch (error) {
      console.error("Gamification stats error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statystyk gamifikacji" });
    }
  });

  // Pobierz heatmapę aktywności
  app.get("/api/gamification/activity-heatmap", requireAuth, async (req, res) => {
    try {
      const activities = await gamificationService.getUserActivityHeatmap(req.user!.id);
      res.json(activities);
    } catch (error) {
      console.error("Activity heatmap error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania heatmapy aktywności" });
    }
  });

  // Pobierz osiągnięcia użytkownika
  app.get("/api/gamification/achievements", requireAuth, async (req, res) => {
    try {
      const achievements = await gamificationService.getUserAchievements(req.user!.id);
      res.json(achievements);
    } catch (error) {
      console.error("Achievements error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania osiągnięć" });
    }
  });

  // Użyj streak freeze
  app.post("/api/gamification/use-freeze", requireAuth, async (req, res) => {
    try {
      const stats = await gamificationService.getUserStats(req.user!.id);
      
      if (stats.streakFreezes <= 0) {
        return res.status(400).json({ error: "Brak dostępnych zamrożeń serii" });
      }

      // Logika użycia streak freeze jest już w updateStreak()
      res.json({ success: true, remainingFreezes: stats.streakFreezes - 1 });
    } catch (error) {
      console.error("Use freeze error:", error);
      res.status(500).json({ error: "Błąd podczas używania zamrożenia" });
    }
  });

  // Pobierz ranking (leaderboard)
  app.get("/api/gamification/leaderboard", requireAuth, async (req, res) => {
    try {
      const requested = parseInt(req.query.limit as string, 10);
      const limit = Number.isFinite(requested) ? Math.min(50, Math.max(1, requested)) : 10;
      const leaderboard = await gamificationService.getLeaderboard(limit);
      // Bez userId — ranking widzą wszyscy zalogowani
      res.json(leaderboard.map(({ userId: _uid, ...entry }) => entry));
    } catch (error) {
      console.error("Leaderboard error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania rankingu" });
    }
  });

  // Admin endpoints
  app.get("/api/admin/questions", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { status, sectionId } = req.query;
      
      let questions;
      if (sectionId) {
        questions = await storage.getQuestionsBySection(sectionId as string, status as string);
      } else {
        // Get all questions across all sections
        const sections = await storage.getSections();
        const allQuestions = [];
        for (const section of sections) {
          const sectionQuestions = await storage.getQuestionsBySection(section.id, status as string);
          allQuestions.push(...sectionQuestions);
        }
        questions = allQuestions;
      }

      // Add statistics for each question
      const questionsWithStats = await Promise.all(
        questions.map(async (question) => {
          const stats = await storage.getQuestionStatistics(question.id);
          return { ...question, stats };
        })
      );

      res.json(questionsWithStats);
    } catch (error) {
      console.error("Admin questions fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytań" });
    }
  });

  app.post("/api/admin/questions", requireAuth, requireReviewer, async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      
      const question = await storage.createQuestion(questionData);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_created",
        entityType: "question",
        entityId: question.id,
        diff: { question: questionData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(question);
    } catch (error: any) {
      console.error("Question creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia pytania" });
    }
  });

  app.put("/api/admin/questions/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      // Tylko edytowalne pola treści — bez createdBy/reviewedBy/wersji (brak mass assignment)
      const parsedUpdates = insertQuestionSchema.omit({ createdBy: true }).partial().safeParse(req.body);
      if (!parsedUpdates.success) {
        return res.status(400).json({ error: "Nieprawidłowe dane pytania", details: parsedUpdates.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
      }
      const updates = parsedUpdates.data;
      
      const oldQuestion = await storage.getQuestionById(id);
      if (!oldQuestion) {
        return res.status(404).json({ error: "Pytanie nie znalezione" });
      }

      const updatedQuestion = await storage.updateQuestion(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_updated",
        entityType: "question",
        entityId: id,
        diff: { old: oldQuestion, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedQuestion);
    } catch (error: any) {
      console.error("Question update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji pytania" });
    }
  });

  app.post("/api/admin/questions/:id/review", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body; // "approve" or "reject"
      
      const newStatus = action === "approve" ? "published" : "draft";
      const question = await storage.updateQuestionStatus(id, newStatus, req.user!.id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: `question_${action}d`,
        entityType: "question",
        entityId: id,
        diff: { status: newStatus },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(question);
    } catch (error: any) {
      console.error("Question review error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas recenzji pytania" });
    }
  });

  // Delete question endpoint
  app.delete("/api/admin/questions/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const question = await storage.getQuestionById(id);
      if (!question) {
        return res.status(404).json({ error: "Pytanie nie znalezione" });
      }

      await storage.deleteQuestion(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "question_deleted",
        entityType: "question",
        entityId: id,
        diff: { question },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Question delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania pytania" });
    }
  });

  // Bulk import questions endpoint
  app.post("/api/admin/questions/bulk", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { items, dryRun = false } = req.body;
      
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required and cannot be empty" });
      }

      // Limit batch size to prevent abuse
      if (items.length > 500) {
        return res.status(400).json({ error: "Maximum 500 questions allowed per batch" });
      }

      const validatedQuestions: any[] = [];
      const validationErrors: Array<{ index: number; errors: string[] }> = [];

      // Validate each question individually
      for (let i = 0; i < items.length; i++) {
        try {
          // Transform aliases to database format if needed
          const item = items[i];
          const questionData = {
            sectionId: item.sectionId,
            title: item.title || item.questionText?.substring(0, 100) || `Pytanie ${i + 1}`,
            bodyMd: item.bodyMd || item.questionText || "",
            explanationMd: item.explanationMd || item.explanation || "",
            answers: item.answers || (item.answerOptions ? item.answerOptions.map((option: string, idx: number) => ({
              text: option,
              isCorrect: idx === (item.correctAnswerIndex || 0)
            })) : []),
            imageUrl: item.imageUrl,
            difficulty: item.difficulty || item.difficultyLevel || "medium",
            tags: item.tags || [],
            status: item.status || "draft",
            createdBy: req.user!.id
          };

          const validatedQuestion = insertQuestionSchema.parse(questionData);
          validatedQuestions.push(validatedQuestion);
        } catch (error: any) {
          console.error(`Validation error for question ${i}:`, error);
          validationErrors.push({
            index: i,
            errors: error.issues ? error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`) : [error.message]
          });
        }
      }

      // If this is a dry run, return validation results without persisting
      if (dryRun) {
        return res.json({
          summary: {
            total: items.length,
            valid: validatedQuestions.length,
            invalid: validationErrors.length
          },
          validationErrors,
          preview: validatedQuestions.slice(0, 5) // Show first 5 for preview
        });
      }

      // Only proceed with valid questions
      if (validatedQuestions.length === 0) {
        return res.status(400).json({ 
          error: "No valid questions to import",
          validationErrors
        });
      }

      // Create questions in bulk
      const result = await storage.createQuestionsBulk(validatedQuestions);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "questions_bulk_imported",
        entityType: "question",
        entityId: "bulk",
        diff: { 
          summary: result.summary,
          totalQuestions: validatedQuestions.length,
          validationErrors: validationErrors.length
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        ...result,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      });
    } catch (error: any) {
      console.error("Bulk question import error:", error);
      res.status(500).json({ error: "Błąd podczas importu pytań" });
    }
  });

  // Admin modules management
  app.get("/api/admin/modules", requireAuth, requireReviewer, async (req, res) => {
    try {
      const modules = await storage.getModulesWithSections();
      res.json(modules);
    } catch (error) {
      console.error("Admin modules fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania modułów" });
    }
  });

  app.post("/api/admin/modules", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { title, description, order, isLocked, prerequisiteModuleId } = req.body;
      
      const module = await storage.createModule({
        title,
        description,
        order,
        isLocked: isLocked || false,
        prerequisiteModuleId
      });

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_created",
        entityType: "module",
        entityId: module.id,
        diff: { module },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(module);
    } catch (error: any) {
      console.error("Module creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia modułu" });
    }
  });

  app.put("/api/admin/modules/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const oldModule = await storage.getModuleById(id);
      if (!oldModule) {
        return res.status(404).json({ error: "Moduł nie znaleziony" });
      }

      const updatedModule = await storage.updateModule(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_updated",
        entityType: "module",
        entityId: id,
        diff: { old: oldModule, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedModule);
    } catch (error: any) {
      console.error("Module update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji modułu" });
    }
  });

  app.delete("/api/admin/modules/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const module = await storage.getModuleById(id);
      if (!module) {
        return res.status(404).json({ error: "Moduł nie znaleziony" });
      }

      await storage.deleteModule(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "module_deleted",
        entityType: "module",
        entityId: id,
        diff: { module },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Module delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania modułu" });
    }
  });

  // Admin sections management
  app.post("/api/admin/sections", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { moduleId, title, description, order, isLocked, prerequisiteSectionId } = req.body;
      
      const section = await storage.createSection({
        moduleId,
        title,
        description,
        order,
        isLocked: isLocked || false,
        prerequisiteSectionId
      });

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_created",
        entityType: "section",
        entityId: section.id,
        diff: { section },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(section);
    } catch (error: any) {
      console.error("Section creation error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas tworzenia sekcji" });
    }
  });

  app.put("/api/admin/sections/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const oldSection = await storage.getSectionById(id);
      if (!oldSection) {
        return res.status(404).json({ error: "Sekcja nie znaleziona" });
      }

      const updatedSection = await storage.updateSection(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_updated",
        entityType: "section",
        entityId: id,
        diff: { old: oldSection, new: updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedSection);
    } catch (error: any) {
      console.error("Section update error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas aktualizacji sekcji" });
    }
  });

  app.delete("/api/admin/sections/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      const section = await storage.getSectionById(id);
      if (!section) {
        return res.status(404).json({ error: "Sekcja nie znaleziona" });
      }

      await storage.deleteSection(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "section_deleted",
        entityType: "section",
        entityId: id,
        diff: { section },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Section delete error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas usuwania sekcji" });
    }
  });

  // Reorder modules
  app.put("/api/admin/modules/reorder", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { moduleIds } = req.body; // Array of module IDs in new order
      
      await storage.reorderModules(moduleIds);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "modules_reordered",
        entityType: "module",
        entityId: "",
        diff: { newOrder: moduleIds },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Module reorder error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zmiany kolejności modułów" });
    }
  });

  // Reorder sections within a module
  app.put("/api/admin/sections/reorder", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { sectionIds, moduleId } = req.body; // Array of section IDs in new order for specific module
      
      await storage.reorderSections(sectionIds, moduleId);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "sections_reordered",
        entityType: "section",
        entityId: "",
        diff: { moduleId, newOrder: sectionIds },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Section reorder error:", error);
      res.status(400).json({ error: error.message || "Błąd podczas zmiany kolejności sekcji" });
    }
  });

  // Object storage endpoints for admin uploads
  app.post("/api/admin/upload", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Upload URL generation error:", error);
      res.status(500).json({ error: "Błąd podczas generowania URL uploadu" });
    }
  });

  app.put("/api/admin/images", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { imageURL } = req.body;
      
      if (!imageURL) {
        return res.status(400).json({ error: "imageURL jest wymagane" });
      }

      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        imageURL,
        {
          owner: req.user!.id,
          visibility: "public", // Images for questions should be public
        }
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error: any) {
      console.error("Error setting image ACL:", error);
      res.status(500).json({ error: "Błąd podczas zapisywania obrazu" });
    }
  });

  // Public file serving endpoint
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error: any) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object entity serving endpoint
  app.get("/objects/:objectPath(*)", requireAuth, async (req, res) => {
    try {
      const { ObjectStorageService, ObjectNotFoundError } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      const allowed = await objectStorageService.canAccessObjectEntity({
        userId: req.user!.id,
        objectFile,
      });
      if (!allowed) {
        return res.status(403).json({ error: "Brak uprawnień do tego pliku" });
      }

      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error checking object access:", error);
      if (error.name === "ObjectNotFoundError") {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Support endpoints
  app.post("/api/support/tickets", apiRateLimit, async (req, res) => {
    try {
      const { subject, message } = req.body;
      
      if (!subject || !message) {
        return res.status(400).json({ error: "Temat i wiadomość są wymagane" });
      }

      const user = req.session?.userId ? await storage.getUser(req.session.userId) : null;
      
      const ticket = await storage.createSupportTicket({
        userId: req.session?.userId || undefined,
        userEmail: user?.email || 'anonymous@unknown.com',
        userName: user ? `${user.firstName} ${user.lastName}` : 'Anonymous User',
        subject,
        message,
        status: "open",
        priority: "medium"
      });

      res.status(201).json(ticket);
    } catch (error) {
      console.error("Support ticket creation error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia zgłoszenia" });
    }
  });

  // Admin endpoints for user management
  app.get("/api/admin/users", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { search, role, status } = req.query;
      let query = db.select().from(users);

      const conditions: any[] = [];
      
      // Apply search filter
      if (search) {
        conditions.push(or(
          ilike(users.email, `%${search}%`),
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`)
        ));
      }

      // Apply role filter
      if (role && role !== 'all') {
        conditions.push(eq(users.role, role as string));
      }

      // Apply status filter
      if (status && status !== 'all') {
        if (status === 'verified') {
          conditions.push(eq(users.emailVerified, true));
        } else if (status === 'unverified') {
          conditions.push(eq(users.emailVerified, false));
        } else if (status === 'suspended') {
          conditions.push(isNotNull(users.suspendedAt));
        } else if (status === 'active') {
          conditions.push(isNull(users.suspendedAt));
        }
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const allUsers = await query.orderBy(desc(users.createdAt));
      res.json(allUsers.map(adminUserView));
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Błąd podczas pobierania użytkowników" });
    }
  });

  app.get("/api/admin/stats/users", requireAuth, requireReviewer, async (req, res) => {
    try {
      const totalUsers = await db.select({ count: count() }).from(users);
      const activeSubscriptions = await db.select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, 'active'));
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const newUsersThisMonth = await db.select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, thirtyDaysAgo));

      res.json({
        totalUsers: totalUsers[0]?.count || 0,
        activeSubscriptions: activeSubscriptions[0]?.count || 0,
        newUsersThisMonth: newUsersThisMonth[0]?.count || 0,
      });
    } catch (error: any) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statystyk" });
    }
  });

  // Tworzenie kont przez panel — wyłącznie właściciel
  app.post("/api/admin/users", requireAuth, requireOwner, async (req, res) => {
    try {
      const parsed = adminCreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Email, hasło (8–128 znaków), imię i nazwisko są wymagane; rola musi być prawidłowa" });
      }
      const { email, password, firstName, lastName, role } = parsed.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Użytkownik o tym adresie email już istnieje" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          emailVerified: true, // Admin-created users are pre-verified
        })
        .returning();

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "user_created",
        entityType: "user",
        entityId: newUser.id,
        diff: { email, firstName, lastName, role },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(adminUserView(newUser));
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia użytkownika" });
    }
  });

  app.put("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = adminUpdateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Nieprawidłowa rola lub status użytkownika" });
      }
      const { role, status } = parsed.data;
      const actor = req.user!;
      const actorIsOwner = actor.role === "owner";

      const target = await storage.getUser(id);
      if (!target) {
        return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      }

      const countOwners = async (opts: { activeOnly: boolean }) => {
        const where = opts.activeOnly
          ? and(eq(users.role, "owner"), isNull(users.suspendedAt))
          : eq(users.role, "owner");
        const [row] = await db.select({ n: count() }).from(users).where(where);
        return Number(row?.n ?? 0);
      };

      const updateData: Partial<typeof users.$inferInsert> = {};

      if (role !== undefined && role !== target.role) {
        // Block self-role change
        if (actor.id === id) {
          return res.status(403).json({ error: "Nie możesz zmieniać własnej roli" });
        }
        // Nadawanie/odbieranie ról admin/owner — tylko właściciel
        if (!actorIsOwner && (PRIVILEGED_ROLES.includes(role) || PRIVILEGED_ROLES.includes(target.role))) {
          return res.status(403).json({ error: "Tylko właściciel może nadawać i odbierać role administratora i właściciela" });
        }
        // Nigdy nie zostawiamy systemu bez właściciela
        if (target.role === "owner" && (await countOwners({ activeOnly: false })) <= 1) {
          return res.status(409).json({ error: "Nie można odebrać roli ostatniemu właścicielowi" });
        }
        updateData.role = role;
      }

      if (status !== undefined) {
        if (actor.id === id && status === "suspended") {
          return res.status(403).json({ error: "Nie możesz zawiesić własnego konta" });
        }
        // Konta admin/owner może zmieniać tylko właściciel
        if (!actorIsOwner && PRIVILEGED_ROLES.includes(target.role) && actor.id !== id) {
          return res.status(403).json({ error: "Tylko właściciel może zmieniać status kont administratorów i właścicieli" });
        }
        if (status === "suspended") {
          if (target.role === "owner" && !target.suspendedAt && (await countOwners({ activeOnly: true })) <= 1) {
            return res.status(409).json({ error: "Nie można zawiesić ostatniego aktywnego właściciela" });
          }
          updateData.suspendedAt = target.suspendedAt ?? new Date();
          // Zgodność ze starym przełącznikiem w panelu (oparty na emailVerified)
          updateData.emailVerified = false;
        } else if (status === "verified") {
          updateData.emailVerified = true;
          updateData.suspendedAt = null;
        } else if (status === "active") {
          updateData.suspendedAt = null;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.json(adminUserView(target));
      }

      const [updatedUser] = await db
        .update(users)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      }

      // Zmiana roli albo zawieszenie → wszystkie sesje tego użytkownika tracą ważność
      const roleChanged = updateData.role !== undefined;
      const suspended = status === "suspended";
      if (roleChanged || suspended) {
        await storage.invalidateUserSessions(id);
      }

      // Create audit log
      await storage.createAuditLog({
        actorId: actor.id,
        action: suspended ? "user_suspended" : roleChanged ? "user_role_changed" : "user_updated",
        entityType: "user",
        entityId: id,
        diff: { ...updateData, previousRole: target.role, previousSuspendedAt: target.suspendedAt },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(adminUserView(updatedUser));
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Błąd podczas aktualizacji użytkownika" });
    }
  });

  // Grant/revoke subscription for user — tylko owner/support
  app.post("/api/admin/users/:id/subscription", requireAuth, requireSubscriptionManager, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = adminSubscriptionSchema.safeParse(req.body);
      if (!parsed.success) {
        const actionInvalid = parsed.error.issues.some((i) => i.path[0] === "action");
        return res.status(400).json({
          error: actionInvalid
            ? "Nieprawidłowa akcja. Użyj 'grant' lub 'revoke'"
            : "Nieprawidłowy czas trwania (1–24 miesiące)",
        });
      }
      const { action, durationMonths } = parsed.data;
      
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) {
        return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      }

      if (action === "grant") {
        // Get or create a manual plan
        let manualPlan = await db.select().from(plans).where(eq(plans.name, "Manual")).limit(1);
        let planId: string;
        
        if (manualPlan.length === 0) {
          const [newPlan] = await db.insert(plans).values({
            name: "Manual",
            price: "0",
            durationDays: 30,
            currency: "PLN",
            isActive: true,
          }).returning();
          planId = newPlan.id;
        } else {
          planId = manualPlan[0].id;
        }

        // Deactivate any existing active subscriptions
        await db.update(subscriptions)
          .set({ status: "cancelled" })
          .where(and(
            eq(subscriptions.userId, id),
            eq(subscriptions.status, "active")
          ));

        // Create new subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + durationMonths);

        const [newSubscription] = await db.insert(subscriptions).values({
          userId: id,
          planId: planId,
          startDate: startDate,
          endDate: endDate,
          status: "active",
          paymentProvider: "manual",
        }).returning();

        // Create audit log
        await storage.createAuditLog({
          actorId: req.user!.id,
          action: "subscription_granted",
          entityType: "subscription",
          entityId: newSubscription.id,
          diff: { userId: id, durationMonths },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.json({ success: true, subscription: newSubscription });
      } else if (action === "revoke") {
        // Revoke all active subscriptions
        await db.update(subscriptions)
          .set({ status: "cancelled", endDate: new Date() })
          .where(and(
            eq(subscriptions.userId, id),
            eq(subscriptions.status, "active")
          ));

        // Create audit log
        await storage.createAuditLog({
          actorId: req.user!.id,
          action: "subscription_revoked",
          entityType: "user",
          entityId: id,
          diff: { userId: id },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.json({ success: true, message: "Subskrypcja została anulowana" });
      } else {
        res.status(400).json({ error: "Nieprawidłowa akcja. Użyj 'grant' lub 'revoke'" });
      }
    } catch (error: any) {
      console.error("Error managing subscription:", error);
      res.status(500).json({ error: "Błąd podczas zarządzania subskrypcją" });
    }
  });

  // Admin Support tickets endpoints
  app.get("/api/admin/support/tickets", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { status, search } = req.query;
      let query = db.select().from(supportTickets);

      // Zgłoszenia z bety i błędy w pytaniach mają własną zakładkę „Zgłoszenia” — tu tylko wiadomości do supportu
      const ticketConditions: any[] = [eq(supportTickets.kind, "support"), sql`${supportTickets.questionId} IS NULL`];
      
      // Apply status filter
      if (status && status !== 'all') {
        ticketConditions.push(eq(supportTickets.status, status as string));
      }

      // Apply search filter
      if (search) {
        ticketConditions.push(or(
          ilike(supportTickets.subject, `%${search}%`),
          ilike(supportTickets.message, `%${search}%`),
          ilike(supportTickets.userEmail, `%${search}%`)
        ));
      }
      
      if (ticketConditions.length > 0) {
        query = query.where(and(...ticketConditions)) as any;
      }

      const tickets = await query.orderBy(desc(supportTickets.createdAt));
      res.json(tickets);
    } catch (error: any) {
      console.error("Error fetching support tickets:", error);
      res.status(500).json({ error: "Błąd podczas pobierania zgłoszeń" });
    }
  });

  app.get("/api/admin/stats/support", requireAuth, requireReviewer, async (req, res) => {
    try {
      const totalTickets = await db.select({ count: count() }).from(supportTickets);
      const openTickets = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'open'));
      const resolvedTickets = await db.select({ count: count() })
        .from(supportTickets)
        .where(eq(supportTickets.status, 'resolved'));

      res.json({
        totalTickets: totalTickets[0]?.count || 0,
        openTickets: openTickets[0]?.count || 0,
        resolvedTickets: resolvedTickets[0]?.count || 0,
        avgResponseTime: 24, // Placeholder
      });
    } catch (error: any) {
      console.error("Error fetching support stats:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statystyk supportu" });
    }
  });

  app.put("/api/admin/support/tickets/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, adminResponse } = req.body;
      
      const updateData: any = { status, updatedAt: new Date() };
      if (adminResponse) {
        updateData.adminResponse = adminResponse;
        updateData.adminUserId = req.user!.id;
      }
      
      const [updatedTicket] = await db
        .update(supportTickets)
        .set(updateData)
        .where(eq(supportTickets.id, id))
        .returning();

      if (!updatedTicket) {
        return res.status(404).json({ error: "Zgłoszenie nie znalezione" });
      }

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "support_ticket_updated",
        entityType: "support_ticket",
        entityId: id,
        diff: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedTicket);
    } catch (error: any) {
      console.error("Error updating support ticket:", error);
      res.status(500).json({ error: "Błąd podczas aktualizacji zgłoszenia" });
    }
  });

  // Analytics endpoints
  app.get("/api/admin/analytics/stats", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { range } = req.query;
      
      // Calculate date range
      let dateFilter = new Date();
      switch (range) {
        case '7d':
          dateFilter.setDate(dateFilter.getDate() - 7);
          break;
        case '90d':
          dateFilter.setDate(dateFilter.getDate() - 90);
          break;
        case '365d':
          dateFilter.setDate(dateFilter.getDate() - 365);
          break;
        default: // 30d
          dateFilter.setDate(dateFilter.getDate() - 30);
      }

      // Get basic platform stats
      const totalUsers = await db.select({ count: count() }).from(users);
      const totalQuestions = await db.select({ count: count() }).from(questions);
      const totalAttempts = await db.select({ count: count() }).from(attempts);
      const activeSubscriptions = await db.select({ count: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, 'active'));
      
      const newUsersThisMonth = await db.select({ count: count() })
        .from(users)
        .where(gte(users.createdAt, dateFilter));
        
      const questionsAddedThisMonth = await db.select({ count: count() })
        .from(questions)
        .where(gte(questions.createdAt, dateFilter));

      // Calculate success rate
      const successfulAttempts = await db.select({ count: count() })
        .from(attempts)
        .where(eq(attempts.isCorrect, true));
      
      const avgSuccessRate = totalAttempts[0]?.count > 0 
        ? (successfulAttempts[0]?.count || 0) / totalAttempts[0].count 
        : 0;

      const revenueResult = await db
        .select({ 
          total: sql<number>`COALESCE(SUM(CAST(${plans.price} AS DECIMAL)), 0)`
        })
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.planId, plans.id))
        .where(and(
          eq(subscriptions.status, 'active'),
          gte(subscriptions.createdAt, dateFilter)
        ));

      const monthlyRevenue = Number(revenueResult[0]?.total) || 0;

      res.json({
        totalUsers: totalUsers[0]?.count || 0,
        totalQuestions: totalQuestions[0]?.count || 0,
        totalAttempts: totalAttempts[0]?.count || 0,
        avgSuccessRate,
        activeSubscriptions: activeSubscriptions[0]?.count || 0,
        monthlyRevenue,
        newUsersThisMonth: newUsersThisMonth[0]?.count || 0,
        questionsAddedThisMonth: questionsAddedThisMonth[0]?.count || 0,
      });
    } catch (error: any) {
      console.error("Error fetching analytics stats:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statystyk" });
    }
  });

  app.get("/api/admin/analytics/performance", requireAuth, requireReviewer, async (req, res) => {
    try {
      // Get average quiz completion time
      const avgCompletionTime = await db.select({ 
        avg: avg(attempts.timeMs) 
      }).from(attempts);

      // Get most difficult questions (lowest success rates)
      const mostDifficultQuestions = await db
        .select({
          id: questions.id,
          questionText: questions.title,
          successRate: sql<number>`CAST(COUNT(CASE WHEN ${attempts.isCorrect} THEN 1 END) AS FLOAT) / COUNT(*)`,
          attempts: count(attempts.id),
        })
        .from(questions)
        .leftJoin(attempts, eq(questions.id, attempts.questionId))
        .groupBy(questions.id, questions.title)
        .having(sql`COUNT(*) >= 10`) // At least 10 attempts
        .orderBy(sql`CAST(COUNT(CASE WHEN ${attempts.isCorrect} THEN 1 END) AS FLOAT) / COUNT(*)`)
        .limit(5);

      // Get best performing sections
      const bestPerformingSections = await db
        .select({
          id: sections.id,
          title: sections.title,
          avgSuccessRate: sql<number>`CAST(COUNT(CASE WHEN ${attempts.isCorrect} THEN 1 END) AS FLOAT) / COUNT(*)`,
          completionRate: sql<number>`0.75`, // Placeholder
        })
        .from(sections)
        .leftJoin(questions, eq(sections.id, questions.sectionId))
        .leftJoin(attempts, eq(questions.id, attempts.questionId))
        .groupBy(sections.id, sections.title)
        .orderBy(sql`CAST(COUNT(CASE WHEN ${attempts.isCorrect} THEN 1 END) AS FLOAT) / COUNT(*) DESC`)
        .limit(5);

      res.json({
        avgQuizCompletionTime: (Number(avgCompletionTime[0]?.avg) || 0) / (1000 * 60), // Convert to minutes
        mostDifficultQuestions: mostDifficultQuestions || [],
        bestPerformingSections: bestPerformingSections || [],
        userEngagement: {
          dailyActiveUsers: 12, // Placeholder
          weeklyActiveUsers: 47,
          monthlyActiveUsers: 156,
          avgSessionTime: 24,
        },
      });
    } catch (error: any) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ error: "Błąd podczas pobierania metryk wydajności" });
    }
  });

  // Lecture chapters endpoints for admins
  app.get("/api/admin/sections/:sectionId/chapters", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { sectionId } = req.params;
      const chapters = await db
        .select({
          id: lectureChapters.id,
          title: lectureChapters.title,
          contentMd: lectureChapters.contentMd,
          analogy: lectureChapters.analogy,
          keyPoints: lectureChapters.keyPoints,
          visual: lectureChapters.visual,
          visualContent: lectureChapters.visualContent,
          order: lectureChapters.order,
          isPublished: lectureChapters.isPublished,
          createdAt: lectureChapters.createdAt,
          updatedAt: lectureChapters.updatedAt,
        })
        .from(lectureChapters)
        .where(eq(lectureChapters.sectionId, sectionId))
        .orderBy(lectureChapters.order);

      res.json(chapters);
    } catch (error: any) {
      console.error("Error fetching lecture chapters:", error);
      res.status(500).json({ error: "Błąd podczas pobierania rozdziałów wykładu" });
    }
  });

  app.post("/api/admin/sections/:sectionId/chapters", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { sectionId } = req.params;
      const { title, contentMd, analogy, keyPoints, visual, visualContent, order } = req.body;

      const [chapter] = await db
        .insert(lectureChapters)
        .values({
          sectionId,
          title,
          contentMd,
          analogy: analogy || null,
          keyPoints: keyPoints || [],
          visual: visual || null,
          visualContent: visualContent || [],
          order,
          isPublished: false,
          createdBy: req.user!.id,
        })
        .returning();

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "lecture_chapter_created",
        entityType: "lecture_chapter",
        entityId: chapter.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(chapter);
    } catch (error: any) {
      console.error("Error creating lecture chapter:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia rozdziału wykładu" });
    }
  });

  app.put("/api/admin/chapters/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, contentMd, analogy, keyPoints, visual, visualContent, order, isPublished } = req.body;

      const [updatedChapter] = await db
        .update(lectureChapters)
        .set({
          title,
          contentMd,
          analogy: analogy || null,
          keyPoints: keyPoints || [],
          visual: visual || null,
          visualContent: visualContent || [],
          order,
          isPublished: isPublished || false,
          updatedAt: new Date(),
        })
        .where(eq(lectureChapters.id, id))
        .returning();

      if (!updatedChapter) {
        return res.status(404).json({ error: "Rozdział wykładu nie znaleziony" });
      }

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "lecture_chapter_updated",
        entityType: "lecture_chapter",
        entityId: id,
        diff: { title, contentMd, analogy, keyPoints, visual, order, isPublished },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedChapter);
    } catch (error: any) {
      console.error("Error updating lecture chapter:", error);
      res.status(500).json({ error: "Błąd podczas aktualizacji rozdziału wykładu" });
    }
  });

  app.delete("/api/admin/chapters/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;

      const [deletedChapter] = await db
        .delete(lectureChapters)
        .where(eq(lectureChapters.id, id))
        .returning();

      if (!deletedChapter) {
        return res.status(404).json({ error: "Rozdział wykładu nie znaleziony" });
      }

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "lecture_chapter_deleted",
        entityType: "lecture_chapter",
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting lecture chapter:", error);
      res.status(500).json({ error: "Błąd podczas usuwania rozdziału wykładu" });
    }
  });

  // Lecture image upload endpoints
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Błąd podczas generowania URL do przesłania" });
    }
  });

  app.put("/api/lecture-images", requireAuth, async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL jest wymagane" });
    }

    const userId = req.user!.id;

    try {
      const { ObjectStorageService } = await import("./objectStorage");
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: userId,
          visibility: "public", // Lecture images are public
        }
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error: any) {
      console.error("Error setting lecture image ACL:", error);
      res.status(500).json({ error: "Błąd podczas konfiguracji obrazu" });
    }
  });

  // Public endpoints for lecture chapters
  app.get("/api/sections/:sectionId/chapters", requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const { sectionId } = req.params;
      const userRole = req.user?.role || 'student';
      const isAdmin = ['owner', 'reviewer', 'developer_admin'].includes(userRole);
      
      // Check if section and its module are visible (only for non-admin users)
      if (!isAdmin) {
        const sectionCheck = await db
          .select({
            sectionId: sections.id,
            sectionVisible: sections.isVisible,
            moduleVisible: modules.isVisible,
          })
          .from(sections)
          .leftJoin(modules, eq(sections.moduleId, modules.id))
          .where(eq(sections.id, sectionId))
          .limit(1);
        
        if (sectionCheck.length === 0) {
          return res.status(404).json({ error: "Sekcja nie znaleziona" });
        }
        
        const { sectionVisible, moduleVisible } = sectionCheck[0];
        if (sectionVisible === false || moduleVisible === false) {
          return res.status(403).json({ error: "Ta treść jest obecnie niedostępna" });
        }
      }
      
      const chapters = await db
        .select({
          id: lectureChapters.id,
          title: lectureChapters.title,
          contentMd: lectureChapters.contentMd,
          analogy: lectureChapters.analogy,
          keyPoints: lectureChapters.keyPoints,
          visual: lectureChapters.visual,
          order: lectureChapters.order,
        })
        .from(lectureChapters)
        .where(and(
          eq(lectureChapters.sectionId, sectionId),
          eq(lectureChapters.isPublished, true)
        ))
        .orderBy(lectureChapters.order);

      res.json(chapters);
    } catch (error: any) {
      console.error("Error fetching lecture chapters:", error);
      res.status(500).json({ error: "Błąd podczas pobierania rozdziałów wykładu" });
    }
  });

  // ============== BLOG ROUTES ==============
  
  // Public Blog Routes (accessible to all)
  app.get("/api/blog", async (req, res) => {
    try {
      const queryData = blogQuerySchema.parse(req.query);
      
      const filters = {
        status: 'published' as const,
        page: queryData.page,
        pageSize: queryData.pageSize,
        tag: queryData.tag,
        q: queryData.q
      };

      const result = await storage.getBlogPosts(filters);
      res.json(result);
    } catch (error: any) {
      console.error("Blog posts fetch error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe parametry zapytania" });
      }
      res.status(500).json({ error: "Błąd podczas pobierania artykułów" });
    }
  });

  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      
      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowy slug artykułu" });
      }

      const blogPost = await storage.getBlogPostBySlug(slug, 'published');
      
      if (!blogPost) {
        return res.status(404).json({ error: "Artykuł nie znaleziony" });
      }

      res.json(blogPost);
    } catch (error: any) {
      console.error("Blog post fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania artykułu" });
    }
  });

  // Admin Blog Routes (require reviewer+ permissions)
  app.get("/api/admin/blog-posts", requireAuth, requireReviewer, async (req, res) => {
    try {
      const queryData = blogQuerySchema.parse(req.query);
      
      const filters = {
        status: queryData.status,
        page: queryData.page,
        pageSize: queryData.pageSize,
        tag: queryData.tag,
        q: queryData.q
      };

      const result = await storage.getBlogPosts(filters);
      res.json(result);
    } catch (error: any) {
      console.error("Admin blog posts fetch error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe parametry zapytania" });
      }
      res.status(500).json({ error: "Błąd podczas pobierania artykułów" });
    }
  });

  app.post("/api/admin/blog-posts", requireAuth, requireReviewer, async (req, res) => {
    try {
      const blogPostData = insertBlogPostSchema.parse({
        ...req.body,
        authorId: req.user!.id,
        status: req.body.status || 'draft'
      });
      
      const blogPost = await storage.createBlogPost(blogPostData);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "blog_post_created",
        entityType: "blog_post",
        entityId: blogPost.id,
        diff: { blogPost: blogPostData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(blogPost);
    } catch (error: any) {
      console.error("Blog post creation error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane artykułu" });
      }
      res.status(500).json({ error: "Błąd podczas tworzenia artykułu" });
    }
  });

  app.patch("/api/admin/blog-posts/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID artykułu" });
      }

      // Validate partial update data
      const updates = insertBlogPostSchema.partial().parse(req.body);
      
      const updatedBlogPost = await storage.updateBlogPost(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "blog_post_updated",
        entityType: "blog_post",
        entityId: id,
        diff: { updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedBlogPost);
    } catch (error: any) {
      console.error("Blog post update error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane aktualizacji" });
      }
      res.status(500).json({ error: "Błąd podczas aktualizacji artykułu" });
    }
  });

  app.patch("/api/admin/blog-posts/:id/status", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID artykułu" });
      }

      const { status } = statusUpdateSchema.parse(req.body);
      
      const updatedBlogPost = await storage.updateBlogPostStatus(id, status);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: `blog_post_${status === 'published' ? 'published' : 'drafted'}`,
        entityType: "blog_post",
        entityId: id,
        diff: { status },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedBlogPost);
    } catch (error: any) {
      console.error("Blog post status update error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowy status artykułu" });
      }
      res.status(500).json({ error: "Błąd podczas zmiany statusu artykułu" });
    }
  });

  app.delete("/api/admin/blog-posts/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID artykułu" });
      }

      await storage.deleteBlogPost(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "blog_post_deleted",
        entityType: "blog_post",
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Blog post deletion error:", error);
      res.status(500).json({ error: "Błąd podczas usuwania artykułu" });
    }
  });

  // Demo Question Routes
  // Public route to get active demo question (legacy - returns single)
  app.get("/api/demo-question", async (req, res) => {
    try {
      const demoQuestion = await storage.getActiveDemoQuestion();
      res.json(demoQuestion);
    } catch (error: any) {
      console.error("Demo question fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytania demo" });
    }
  });

  // Public route to get all active demo questions
  app.get("/api/demo-questions", async (req, res) => {
    try {
      const demoQuestions = await storage.getActiveDemoQuestions();
      res.json(demoQuestions);
    } catch (error: any) {
      console.error("Demo questions fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytań demo" });
    }
  });

  // Admin routes for demo questions
  app.get("/api/admin/demo-question", requireAuth, requireReviewer, async (req, res) => {
    try {
      const demoQuestions = await storage.getAllDemoQuestions();
      res.json(demoQuestions);
    } catch (error: any) {
      console.error("Demo questions fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania pytań demo" });
    }
  });

  app.post("/api/admin/demo-question", requireAuth, requireReviewer, async (req, res) => {
    try {
      const demoQuestionData = insertDemoQuestionSchema.parse(req.body);
      const demoQuestion = await storage.createDemoQuestion(demoQuestionData);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "demo_question_created",
        entityType: "demo_question",
        entityId: demoQuestion.id,
        diff: { demoQuestion: demoQuestionData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(demoQuestion);
    } catch (error: any) {
      console.error("Demo question creation error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane pytania demo" });
      }
      res.status(500).json({ error: "Błąd podczas tworzenia pytania demo" });
    }
  });

  app.patch("/api/admin/demo-question/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID pytania demo" });
      }

      const updates = insertDemoQuestionSchema.partial().parse(req.body);
      const updatedDemoQuestion = await storage.updateDemoQuestion(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "demo_question_updated",
        entityType: "demo_question",
        entityId: id,
        diff: { updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedDemoQuestion);
    } catch (error: any) {
      console.error("Demo question update error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane aktualizacji" });
      }
      res.status(500).json({ error: "Błąd podczas aktualizacji pytania demo" });
    }
  });

  app.delete("/api/admin/demo-question/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID pytania demo" });
      }

      await storage.deleteDemoQuestion(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "demo_question_deleted",
        entityType: "demo_question",
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Demo question deletion error:", error);
      res.status(500).json({ error: "Błąd podczas usuwania pytania demo" });
    }
  });

  // ============================================================================
  // HOME PAGE CONTENT ROUTES
  // ============================================================================

  // Public endpoint to get all home page content
  app.get("/api/home-page-content", async (req, res) => {
    try {
      const content = await storage.getAllHomePageContent();
      res.json(content);
    } catch (error: any) {
      console.error("Home page content fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania treści strony głównej" });
    }
  });

  // Admin endpoints for managing home page content
  app.get("/api/admin/home-page-content", requireAuth, requireReviewer, async (req, res) => {
    try {
      const content = await storage.getAllHomePageContent();
      res.json(content);
    } catch (error: any) {
      console.error("Home page content fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania treści strony głównej" });
    }
  });

  app.post("/api/admin/home-page-content", requireAuth, requireReviewer, async (req, res) => {
    try {
      const contentData = insertHomePageContentSchema.parse(req.body);
      const newContent = await storage.createHomePageContent(contentData);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "home_page_content_created",
        entityType: "home_page_content",
        entityId: newContent.id,
        diff: { data: contentData },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json(newContent);
    } catch (error: any) {
      console.error("Home page content creation error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane treści" });
      }
      res.status(500).json({ error: "Błąd podczas tworzenia treści strony głównej" });
    }
  });

  app.patch("/api/admin/home-page-content/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID treści" });
      }

      const updates = insertHomePageContentSchema.partial().parse(req.body);
      const updatedContent = await storage.updateHomePageContent(id, updates);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "home_page_content_updated",
        entityType: "home_page_content",
        entityId: id,
        diff: { updates },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json(updatedContent);
    } catch (error: any) {
      console.error("Home page content update error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Nieprawidłowe dane aktualizacji" });
      }
      res.status(500).json({ error: "Błąd podczas aktualizacji treści strony głównej" });
    }
  });

  app.delete("/api/admin/home-page-content/:id", requireAuth, requireReviewer, async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: "Nieprawidłowe ID treści" });
      }

      await storage.deleteHomePageContent(id);

      // Create audit log
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "home_page_content_deleted",
        entityType: "home_page_content",
        entityId: id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Home page content deletion error:", error);
      res.status(500).json({ error: "Błąd podczas usuwania treści strony głównej" });
    }
  });

  // Report error/bug endpoint
  app.post("/api/report-error", requireAuth, async (req, res) => {
    try {
      const { questionId, message } = req.body;
      
      if (!questionId || !message) {
        return res.status(400).json({ error: "Pytanie i wiadomość są wymagane" });
      }

      // Create support ticket
      const ticket = await storage.createSupportTicket({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: `${req.user!.firstName} ${req.user!.lastName}`,
        subject: `Zgłoszenie błędu w pytaniu`,
        message: message,
        questionId: questionId,
        status: "open",
        priority: "medium"
      });

      res.status(201).json({ 
        success: true, 
        message: "Zgłoszenie zostało wysłane. Dziękujemy za pomoc!",
        ticketId: ticket.id 
      });
    } catch (error: any) {
      console.error("Error report creation error:", error);
      res.status(500).json({ error: "Błąd podczas wysyłania zgłoszenia" });
    }
  });

  (await import("./feedbackRoutes")).registerFeedbackRoutes(app); // zgłoszenia testerów (beta)
  const httpServer = createServer(app);
  return httpServer;
}
