import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import { z } from "zod";
import { storage } from "./storage";
import { authService, KontoIstnieje } from "./auth";
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
  requireKonto,
  requireRole,
  ACCOUNT_SUSPENDED_MESSAGE,
} from "./middleware/auth";
import {
  platnosciWlaczone,
  indeksowanieWlaczone,
  rejestracjaPrzyjmuje,
  ustawienie,
  wszystkieUstawienia,
  zapiszUstawienie,
  USTAWIENIA,
  type KluczUstawienia,
} from "./ustawienia";
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
  mailDoAdresuDozwolony,
} from "./middleware/rateLimit";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  insertQuestionSchema,
  PASSWORD_MIN_LENGTH,
  DOKUMENTY,
  type DokumentId,
  PASSWORD_MAX_LENGTH,
  type User,
} from "@shared/schema";
import { db } from "./db";
import { users, modules, sections, questions, attempts, progress, subscriptions, plans, certificates, auditLog, supportTickets, lectureChapters, userConsents } from "@shared/schema";
import { eq, or, and, gte, desc, count, ilike, avg, sql, isNull, isNotNull } from "drizzle-orm";
import { getUncachableStripeClient, getStripePublishableKey, stripeSource } from "./stripeClient";
import { linkZMaila } from "./mailLinks";
import { config } from "./config";
import { aktywujPlatnosc, anulujSubskrypcjeKonta, anulujWStripe } from "./platnosci";
import { przyUsunieciuKonta, zapiszCzytanie, poOdpowiedzi } from "./szkolenie/serwis";

/** Imię i nazwisko na certyfikat: litery (także polskie), spacja, łącznik, apostrof */
const namePart = (label: string) =>
  z.string().trim().min(1, `Podaj ${label}`).max(60, `${label[0].toUpperCase()}${label.slice(1)} jest za długie`)
    .regex(/^[\p{L}][\p{L}\p{M} '’.-]*$/u, `Sprawdź ${label}: tylko litery, spacja albo łącznik`);
const certificateNameSchema = z.object({
  firstName: namePart("imię").optional(),
  lastName: namePart("nazwisko").optional(),
});

// ── Role i zarządzanie kontami ─────────────────────────────────────────────
const USER_ROLES = ["owner", "admin", "reviewer", "support", "student"] as const;
// Role, które może nadawać/odbierać wyłącznie właściciel
const PRIVILEGED_ROLES: readonly string[] = ["owner", "admin"];

const adminCreateUserSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
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

const zmianaHaslaSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Nowe hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków`).max(PASSWORD_MAX_LENGTH),
});

// Ta sama odpowiedź dla nowego i istniejącego adresu: formularz nie zdradza, czy konto już jest
const REGISTER_MESSAGE = "Sprawdź skrzynkę: wysłaliśmy link, którym potwierdzisz adres e-mail. Link działa 24 godziny.";
const REJESTRACJA_ZAMKNIETA = "Rejestracja jest chwilowo zamknięta. Jeśli masz już konto, zaloguj się.";

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
    emailVerificationExpiry: _eve,
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

/** Lista kont (dane osobowe): właściciel, admin (zawiesza i usuwa konta) i recenzent */
const requireUserViewer = requireRole(["owner", "admin", "reviewer"]);

/** Tylko gdy płatności są włączone (PLATNOSCI_WLACZONE): inaczej trasy zakupu nie istnieją (404) */
function tylkoGdyPlatnosci(_req: Request, res: Response, next: import("express").NextFunction) {
  if (platnosciWlaczone()) return next();
  res.status(404).json({ error: "Nie znaleziono" });
}

/** Dokumenty (regulamin bety, polityka prywatności): Markdown z dist/dokumenty (produkcja) albo docs/dokumenty (podgląd) */
function plikDokumentu(id: DokumentId): string | null {
  const nazwa = id === "regulamin_bety" ? "regulamin-bety.md" : "polityka-prywatnosci.md";
  const katalogi = [
    process.env.DOKUMENTY_DIR,
    path.resolve(import.meta.dirname, "dokumenty"),
    path.resolve(process.cwd(), "docs/dokumenty"),
  ].filter(Boolean) as string[];
  for (const k of katalogi) {
    const plik = path.join(k, nazwa);
    if (fs.existsSync(plik)) return fs.readFileSync(plik, "utf8");
  }
  return null;
}

/**
 * Usunięcie konta z danymi (RODO): samodzielnie z hasłem albo przez admina na prośbę użytkownika.
 * Wszystko albo nic: subskrypcje anulowane, zgłoszenia zanonimizowane, sesje i konto usunięte
 * (postęp, odpowiedzi, zgody, certyfikaty kasują się kaskadowo), wpis audytu bez danych osobowych.
 * Wyjątek: osoba z zaświadczeniem szkolenia z punktami zostaje w rejestrze (zapis, dziennik, wynik testu,
 * zaświadczenia) 5 lat od końca roku wydania; patrz przyUsunieciuKonta i czyscPrzeterminowane.
 */
async function usunKontoZDanymi(cel: User, kto: { actorId: string; akcja: string; ip?: string; ua?: string }) {
  // id subskrypcji Stripe znikają razem z kontem: odczyt przed transakcją, anulowanie dopiero po udanym usunięciu
  const anuluj = await anulujSubskrypcjeKonta(cel.id);
  await db.transaction(async (tx) => {
    await tx.update(subscriptions)
      .set({ status: "cancelled", endDate: new Date() })
      .where(and(eq(subscriptions.userId, cel.id), eq(subscriptions.status, "active")));

    // Zgłoszenia zostają (historia supportu), ale bez danych osobowych
    await tx.update(supportTickets)
      .set({ userEmail: "usuniete-konto@helloekg.invalid", userName: "Usunięte konto", userId: null })
      .where(or(eq(supportTickets.userId, cel.id), eq(supportTickets.userEmail, cel.email)));

    // actor_id zostanie wyzerowany przez ON DELETE SET NULL, gdy konto usuwa samo siebie
    await tx.insert(auditLog).values({
      actorId: kto.actorId,
      action: kto.akcja,
      entityType: "user",
      entityId: cel.id,
      ipAddress: kto.ip,
      userAgent: kto.ua,
    });

    // Szkolenie z punktami: osoba z zaświadczeniem zostaje w rejestrze 5 lat od końca roku wydania
    // (user_id = NULL, bez treści odpowiedzi testu); bez zaświadczenia dane szkolenia znikają z kontem
    await przyUsunieciuKonta(tx, cel.id);

    await tx.execute(sql`DELETE FROM session WHERE sess::jsonb->>'userId' = ${cel.id}`);
    await tx.delete(users).where(eq(users.id, cel.id));
  });
  await anuluj();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for Replit environment
  app.set('trust proxy', 1);

  // Do dnia startu cały host poza wyszukiwarkami (INDEKSOWANIE=1 w konfiguracji serwera to zdejmuje)
  app.use((_req, res, next) => {
    if (!indeksowanieWlaczone()) res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(indeksowanieWlaczone() ? "User-agent: *\nAllow: /\n" : "User-agent: *\nDisallow: /\n");
  });
  // RFC 9116: gdzie zgłaszać podatności
  app.get("/.well-known/security.txt", (_req, res) => {
    res.type("text/plain").send([
      "Contact: mailto:kontakt@helloekg.pl",
      "Expires: 2027-11-10T00:00:00.000Z",
      "Preferred-Languages: pl, en",
      "Canonical: https://kurs.helloekg.pl/.well-known/security.txt",
      "",
    ].join("\n"));
  });

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

  // Grafiki kursu zaimportowane ze studia: tylko z sesją potwierdzonego konta (to też treść kursu).
  // Obrazy w wykładach i pytaniach to adresy z tej samej domeny, więc przeglądarka sama dołącza ciasteczko sesji.
  if (process.env.CONTENT_ASSETS_DIR) {
    app.use(
      "/content-assets",
      requireKonto,
      express.static(process.env.CONTENT_ASSETS_DIR, {
        fallthrough: false,
        index: false,
        dotfiles: "deny",
        // prywatne: bez cache pośredników; nazwy plików to skróty treści, więc w przeglądarce mogą leżeć długo
        setHeaders: (res) => res.setHeader("Cache-Control", "private, max-age=604800, immutable"),
      })
    );
  }

  // Auth endpoints
  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Sprawdź dane w formularzu" });
    }
    const dane = parsed.data;
    const email = dane.email.toLowerCase();

    // Pole-pułapka wypełnione: to automat. Odpowiadamy jak zwykle, niczego nie zapisujemy i nie wysyłamy.
    if (dane.website) {
      auditSafe({
        actorId: null,
        action: "register_honeypot",
        entityType: "auth",
        entityId: NIL_UUID,
        diff: { emailHash: hashEmail(email) },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(201).json({ message: REGISTER_MESSAGE });
    }

    if (!(await rejestracjaPrzyjmuje())) {
      return res.status(403).json({ error: REJESTRACJA_ZAMKNIETA, code: "REGISTRATION_CLOSED" });
    }

    try {
      const { user, verificationToken } = await authService.registerUser({
        email,
        password: dane.password,
        firstName: dane.firstName,
      });
      auditSafe({
        actorId: user.id,
        action: "user_registered",
        entityType: "user",
        entityId: user.id,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // odpowiedź od razu, mail w tle: czas odpowiedzi nie zdradza, czy konto było nowe
      res.status(201).json({ message: REGISTER_MESSAGE });
      if (await mailDoAdresuDozwolony(email, "rejestracja")) {
        emailService.sendEmailVerification(user.email, user.firstName, linkZMaila("/verify-email", verificationToken))
          .catch((e) => console.error("Failed to send verification email:", e?.message));
      }
    } catch (error: any) {
      // Adres ma już konto (albo równoległa rejestracja zdążyła je założyć): ta sama odpowiedź,
      // a właściciel skrzynki dostaje maila z linkiem do logowania i resetu hasła
      const istnieje = error instanceof KontoIstnieje || error?.code === "23505" || error?.cause?.code === "23505";
      if (istnieje) {
        res.status(201).json({ message: REGISTER_MESSAGE });
        auditSafe({
          actorId: null,
          action: "register_existing_email",
          entityType: "auth",
          entityId: NIL_UUID,
          diff: { emailHash: hashEmail(email) },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        if (await mailDoAdresuDozwolony(email, "rejestracja")) {
          emailService.sendAccountExists(email)
            .catch((e) => console.error("Failed to send account-exists email:", e?.message));
        }
        return;
      }
      console.error("Registration error:", error?.message);
      res.status(500).json({ error: "Nie udało się założyć konta. Spróbuj ponownie za chwilę." });
    }
  });

  // Ustawienia widoczne dla każdego (strona startowa, formularz rejestracji, trasy płatności)
  app.get("/api/config", async (_req, res) => {
    res.json({
      rejestracjaOtwarta: await rejestracjaPrzyjmuje(),
      dokumentyOpublikowane: await ustawienie("dokumenty_opublikowane"),
      platnosci: platnosciWlaczone(),
    });
  });

  // Regulamin bety i polityka prywatności: publiczne po akceptacji JK (dokumenty_opublikowane);
  // wcześniej czyta je tylko właściciel i admin (podgląd projektu)
  app.get("/api/dokumenty/:id", async (req, res) => {
    const id = req.params.id as DokumentId;
    if (!Object.hasOwn(DOKUMENTY, id)) return res.status(404).json({ error: "Nie znaleziono" });
    let wolno = await ustawienie("dokumenty_opublikowane");
    if (!wolno && req.session?.userId) {
      const u = await storage.getUser(req.session.userId);
      wolno = !!u && !u.suspendedAt && ["owner", "admin"].includes(u.role);
    }
    const tresc = wolno ? plikDokumentu(id) : null;
    if (!tresc) return res.status(404).json({ error: "Nie znaleziono" });
    res.json({ id, wersja: DOKUMENTY[id].wersja, tytul: DOKUMENTY[id].tytul, tresc });
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
      const blockedFor = await loginEmailBlockedFor(email, req.ip);
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
        await recordLoginFailure(email, req.ip);
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

      await clearLoginFailures(email, req.ip);

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

  // Potwierdzenie adresu: POST z przycisku na stronie /verify-email (samo otwarcie linku przez skaner poczty
  // niczego nie potwierdza). Po potwierdzeniu wylogowujemy inne sesje konta: ktoś, kto założył konto na cudzy
  // adres i był zalogowany, traci je, gdy właściciel skrzynki kliknie link.
  app.post("/api/auth/verify-email", authRateLimit, async (req, res) => {
    try {
      const { token } = req.body ?? {};
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Brak tokenu weryfikacyjnego" });
      }

      const user = token.length <= 200 ? await authService.verifyEmail(token) : null;
      
      if (!user) {
        return res.status(400).json({ error: "Link jest nieprawidłowy albo wygasł" });
      }
      await db.execute(sql`DELETE FROM session WHERE sess::jsonb->>'userId' = ${user.id} AND sid <> ${req.sessionID ?? ""}`);

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
        message: "Adres e-mail potwierdzony. Możesz zacząć kurs." 
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
      
      if (!email || typeof email !== "string" || email.length > 255) {
        return res.status(400).json({ error: "Podaj adres e-mail" });
      }

      // Ta sama odpowiedź niezależnie od tego, czy konto istnieje / jest już zweryfikowane
      const genericResponse = { message: "Jeśli konto istnieje i nie jest jeszcze zweryfikowane, wysłaliśmy nowy link weryfikacyjny" };

      // odpowiedź od razu, reszta w tle: czas odpowiedzi nie zdradza, czy konto istnieje (nawet zapis tokenu)
      res.json(genericResponse);
      (async () => {
        // najwyżej 3 maile na godzinę na adres (limit na IP da się obejść, skrzynka ofiary nie)
        if (!(await mailDoAdresuDozwolony(email, "weryfikacja"))) return;
        const user = await storage.getUserByEmail(email);
        if (!user || user.emailVerified) return;
        // Nowy token (24 h); poprzedni link przestaje działać
        const newToken = await authService.newVerificationToken(user.id);
        await emailService.sendEmailVerification(user.email, user.firstName, linkZMaila("/verify-email", newToken));
      })().catch((emailError) => console.error("Failed to resend verification email:", emailError?.message));
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
      const odpowiedz = { message: "Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła" };
      // odpowiedź od razu, reszta w tle: czas odpowiedzi nie zdradza, czy konto istnieje (nawet zapis tokenu)
      res.json(odpowiedz);
      const ip = req.ip, ua = req.get("User-Agent");
      (async () => {
        // najwyżej 3 maile na godzinę na adres; ponad limit bez nowego tokenu (ważny link z poprzedniego maila zostaje)
        if (!(await mailDoAdresuDozwolony(email, "reset"))) return;
        const resetToken = await authService.initiatePasswordReset(email);
        auditSafe({
          actorId: null,
          action: "password_reset_requested",
          entityType: "auth",
          entityId: NIL_UUID,
          diff: { emailHash: hashEmail(email), accountExists: !!resetToken },
          ipAddress: ip,
          userAgent: ua,
        });
        if (!resetToken) return;
        const user = await storage.getUserByEmail(email);
        if (user) await emailService.sendPasswordReset(user.email, user.firstName, linkZMaila("/reset-password", resetToken));
      })().catch((emailError) => console.error("Failed to send password reset email:", emailError?.message));
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Wystąpił błąd. Spróbuj ponownie później" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        const pierwszy = parsed.error.issues[0];
        return res.status(400).json({
          error: pierwszy?.path[0] === "password" || pierwszy?.path[0] === "confirmPassword"
            ? pierwszy.message
            : `Nieprawidłowe dane. Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków`,
        });
      }

      const { token, password } = parsed.data;
      const result = await authService.resetPassword(token, password);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      if (result.user) {
        await storage.createAuditLog({
          actorId: result.user.id,
          action: "password_reset",
          entityType: "user",
          entityId: result.user.id,
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        });
        // sesje unieważnia już authService.resetPassword; właściciel skrzynki dostaje powiadomienie
        emailService.sendPasswordChanged(result.user.email, result.user.firstName)
          .catch((e) => console.error("Failed to send password-changed email:", e?.message));
      }

      res.json({ message: "Hasło zmienione. Zaloguj się nowym hasłem" });
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
  // Zmiana hasła z konta: obecne hasło, nowe co najmniej 10 znaków; inne sesje wylogowane, mail z powiadomieniem
  app.post("/api/auth/change-password", accountDeleteRateLimit, requireAuth, async (req, res) => {
    const parsed = zmianaHaslaSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Sprawdź hasła" });
    }
    try {
      const user = req.user!;
      if (!(await authService.verifyPassword(parsed.data.currentPassword, user.password))) {
        auditSafe({ actorId: user.id, action: "password_change_failed", entityType: "user", entityId: user.id, ipAddress: req.ip, userAgent: req.get("User-Agent") });
        return res.status(403).json({ error: "Obecne hasło się nie zgadza" });
      }
      if (parsed.data.currentPassword === parsed.data.newPassword) {
        return res.status(400).json({ error: "Nowe hasło musi być inne niż obecne" });
      }
      await storage.updateUser(user.id, { password: await authService.hashPassword(parsed.data.newPassword) });
      await db.execute(sql`DELETE FROM session WHERE sess::jsonb->>'userId' = ${user.id} AND sid <> ${req.sessionID}`);
      auditSafe({ actorId: user.id, action: "password_changed", entityType: "user", entityId: user.id, ipAddress: req.ip, userAgent: req.get("User-Agent") });
      res.json({ success: true });
      emailService.sendPasswordChanged(user.email, user.firstName)
        .catch((e) => console.error("Password changed email failed:", e?.message));
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Nie udało się zmienić hasła. Spróbuj ponownie." });
    }
  });

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

      // ostatni właściciel nie usuwa sam siebie: panel zostałby bez nikogo z pełnymi uprawnieniami
      if (req.user!.role === "owner") {
        const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "owner"));
        if (Number(n) <= 1) {
          return res.status(409).json({ error: "To jedyne konto właściciela. Najpierw nadaj tę rolę innej osobie." });
        }
      }

      await usunKontoZDanymi(req.user!, {
        actorId: userId,
        akcja: "account_deleted",
        ip: req.ip,
        ua: req.get("User-Agent"),
      });

      emailService.sendAccountDeleted(userEmail, userFirstName)
        .catch((e) => console.error("Failed to send account deletion confirmation email:", e?.message));

      req.session.destroy(() => {});
      res.clearCookie("connect.sid");

      res.json({ message: "Konto zostało usunięte zgodnie z życzeniem." });
    } catch (error: any) {
      console.error("Account deletion error:", error);
      // 23503 = FK: konto zespołu z autorstwem treści (pytania, rozdziały) — nie da się usunąć samoobsługowo
      if (error?.code === "23503" || error?.cause?.code === "23503") {
        return res.status(409).json({ error: "Tego konta nie można usunąć samodzielnie. Napisz do nas: kontakt@helloekg.pl" });
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
        locale: req.user!.locale,
        emailVerified: req.user!.emailVerified,
      }
    });
  });

  // Subscription and payment endpoints
  app.get("/api/plans", tylkoGdyPlatnosci, async (req, res) => {
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
          odnawiana: Boolean(subscription.stripeSubscriptionId),
        },
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania statusu subskrypcji" });
    }
  });

  /**
   * Komunikat błędu dla kursanta: własne komunikaty aplikacji tak, błędy bazy nigdy. Błąd bazy ma `code`,
   * a od drizzle-orm 0.45 przychodzi opakowany (DrizzleQueryError „Failed query: …”, kod w `cause`).
   */
  const bladDlaKlienta = (error: any, domyslny: string): string =>
    error && typeof error.message === "string" && !error.code && !error.cause && error.name !== "DrizzleQueryError"
      ? error.message
      : domyslny;
  /** Odpowiedź interaktywna (luki, przeciąganie, kolejność): rozsądny rozmiar, bez dowolnie długich napisów. */
  const odpowiedzZaDuza = (answerData: unknown): boolean =>
    answerData !== undefined && JSON.stringify(answerData).length > 4000;

  /**
   * Adres, na który Stripe wraca po płatności: APP_BASE_URL z konfiguracji serwera (za nginx req.protocol to http,
   * a nagłówek Host przychodzi od klienta), a bez niej, jak dotąd, z żądania.
   */
  const adresPowrotu = (req: Request) => {
    // na produkcji nigdy z nagłówka Host (podaje go klient)
    if (!process.env.APP_BASE_URL && config.isProduction) throw new Error("Brak APP_BASE_URL w konfiguracji serwera");
    return (process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  };
  /** Metody w Stripe Checkout (STRIPE_METODY, domyślnie karta, BLIK, Przelewy24); każda musi być włączona w panelu Stripe */
  const metodyPlatnosci = () =>
    (process.env.STRIPE_METODY || "card,blik,p24").split(",").map((m) => m.trim()).filter(Boolean) as any[];
  /**
   * Sesja Stripe Checkout dla planu. Plan z interval (miesięczny) to subskrypcja odnawiana kartą: BLIK i Przelewy24
   * nie obsługują płatności cyklicznych w Stripe. Plan bez interval to jednorazowa płatność (karta, BLIK, Przelewy24).
   * Metadane (plan, konto albo adres gościa, zgoda na rozpoczęcie przed upływem 14 dni) idą do sesji i do subskrypcji.
   */
  const sesjaCheckout = async (
    req: Request,
    plan: { id: string; name: string; price: string; currency: string; durationDays: number; interval: string | null },
    klient: { customer?: string; customerEmail?: string },
    kto: { userId?: string; guestEmail?: string },
  ) => {
    const stripe = await getUncachableStripeClient();
    const odnawiany = plan.interval === "month" || plan.interval === "year";
    const metadata: Record<string, string> = {
      ...kto,
      planId: plan.id,
      durationDays: plan.durationDays.toString(),
      zgodaNatychmiast: new Date().toISOString(),
    };
    return stripe.checkout.sessions.create({
      ...(klient.customer ? { customer: klient.customer } : { customer_email: klient.customerEmail }),
      ...(!odnawiany && !klient.customer ? { customer_creation: "always" as const } : {}),
      payment_method_types: odnawiany ? (["card"] as any[]) : metodyPlatnosci(),
      line_items: [{
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: {
            name: plan.name,
            description: odnawiany
              ? `Dostęp do kursu helloEKG, odnawiany co ${plan.interval === "year" ? "rok" : "miesiąc"}`
              : `Dostęp do kursu helloEKG na ${plan.durationDays} dni, bez odnawiania`,
          },
          unit_amount: Math.round(parseFloat(plan.price) * 100),
          ...(odnawiany ? { recurring: { interval: plan.interval as "month" | "year" } } : {}),
        },
        quantity: 1,
      }],
      mode: odnawiany ? "subscription" : "payment",
      locale: "pl",
      ...(odnawiany ? { subscription_data: { metadata } } : {}),
      success_url: `${adresPowrotu(req)}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${adresPowrotu(req)}/pricing?payment=cancelled`,
      metadata,
    });
  };

  /** Płatności wyłączone (brak kluczy Stripe): 503 z jasnym komunikatem zamiast ogólnego błędu. */
  const bezStripe = (res: Response) => {
    if (stripeSource()) return false;
    res.status(503).json({ error: "Płatności nie są jeszcze włączone" });
    return true;
  };

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", tylkoGdyPlatnosci, async (req, res) => {
    if (bezStripe(res)) return;
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Stripe config error:", error);
      res.status(500).json({ error: "Stripe nie jest skonfigurowany" });
    }
  });

  // Zakup tylko z konta (cennik i cała aplikacja wymagają zalogowania): bez zakupu gościa i bez
  // finalize-payment, który zwracał adres e-mail dla dowolnego numeru sesji.

  // Create Stripe Checkout session
  app.post("/api/stripe/checkout", tylkoGdyPlatnosci, paymentRateLimit, requireAuth, async (req, res) => {
    if (bezStripe(res)) return;
    try {
      const { planId } = req.body;
      
      const plan = await storage.getActivePlans().then(plans => 
        plans.find(p => p.id === planId)
      );
      
      if (!plan) {
        return res.status(404).json({ error: "Plan nie znaleziony" });
      }
      if (!(parseFloat(plan.price) > 0)) {
        return res.status(400).json({ error: "Ten plan nie jest dostępny do zakupu" });
      }
      if (req.body?.zgodaNatychmiast !== true) {
        return res.status(400).json({ error: "Zaznacz zgodę na rozpoczęcie dostępu przed upływem 14 dni" });
      }

      // Bez podwójnych obciążeń: druga subskrypcja albo subskrypcja przy opłaconym dostępie rocznym
      const obecna = await storage.getStoredActiveSubscription(req.user!.id);
      if (obecna?.stripeSubscriptionId) {
        return res.status(409).json({ error: "Masz już subskrypcję. Zarządzasz nią w menu konta: Płatności." });
      }
      if (obecna && plan.interval) {
        return res.status(409).json({ error: `Masz opłacony dostęp do ${new Date(obecna.endDate).toLocaleDateString("pl-PL")}. Subskrypcję włączysz po jego końcu.` });
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

      const session = await sesjaCheckout(req, plan, { customer: customerId }, { userId: req.user!.id });
      // zgoda na dostęp przed upływem 14 dni (art. 38 pkt 13 ustawy o prawach konsumenta): zapis w koncie,
      // potwierdzenie idzie też w mailu po płatności
      await db.insert(userConsents).values({ userId: req.user!.id, document: "dostep_przed_14_dniami", version: "1.0" });
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout session error:", error);
      res.status(500).json({ error: "Błąd podczas tworzenia sesji płatności" });
    }
  });

  // Strona powrotu zalogowanego kursanta: to samo co webhook, jeśli webhook jeszcze nie dotarł
  app.post("/api/stripe/payment-success", tylkoGdyPlatnosci, paymentRateLimit, requireAuth, async (req, res) => {
    if (bezStripe(res)) return;
    try {
      const sessionId = req.body?.sessionId;
      if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,250}$/.test(sessionId)) {
        return res.status(400).json({ error: "Brak ID sesji" });
      }

      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // tylko płatność tego konta: sesja zalogowanego zakupu niesie jego userId
      if (session.metadata?.userId === req.user!.id) {
        const wynik = await aktywujPlatnosc(session);
        if (wynik) {
          return res.json({
            success: true,
            subscription: { startDate: wynik.subscription.startDate, endDate: wynik.subscription.endDate },
          });
        }
      }

      res.status(400).json({ error: "Płatność nie została zrealizowana" });
    } catch (error) {
      console.error("Payment success error:", error);
      res.status(500).json({ error: "Błąd podczas przetwarzania płatności" });
    }
  });

  // Portal klienta Stripe: zmiana karty, faktury, anulowanie subskrypcji (na koniec opłaconego okresu)
  // także przy wyłączonej sprzedaży (PLATNOSCI_WLACZONE): kto ma subskrypcję, musi móc ją anulować
  app.post("/api/stripe/portal", paymentRateLimit, requireKonto, async (req, res) => {
    if (bezStripe(res)) return;
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user?.stripeCustomerId) {
        return res.status(404).json({ error: "Nie masz jeszcze płatności w helloEKG" });
      }
      const stripe = await getUncachableStripeClient();
      const portal = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${adresPowrotu(req)}/dashboard`,
        locale: "pl",
      });
      res.json({ url: portal.url });
    } catch (error: any) {
      console.error("Stripe portal error:", error?.message);
      res.status(500).json({ error: "Nie udało się otworzyć ustawień płatności" });
    }
  });

  // Quiz endpoints
  // Get modules with sections and user progress
  app.get("/api/modules", requireKonto, async (req, res) => {
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
          .where(and(eq(questions.status, "published"), eq(questions.pool, "practice"))).groupBy(questions.sectionId),
        db.select({ sectionId: lectureChapters.sectionId, n: count() }).from(lectureChapters)
          .where(eq(lectureChapters.isPublished, true)).groupBy(lectureChapters.sectionId),
      ]);
      const qBySection = new Map(questionCounts.map((r) => [r.sectionId, Number(r.n)]));
      const chBySection = new Map(chapterCounts.map((r) => [r.sectionId, Number(r.n)]));
      // Miejsce w wykładach tego użytkownika — jedno zapytanie dla wszystkich sekcji
      const readBySection = new Map(
        (await storage.getLectureReads(req.user!.id)).map((r) => [r.sectionId, r]),
      );

      // Build modules with sections and progress
      const modulesWithSections = await Promise.all(
        allModules.map(async (module) => {
          let sections = await storage.getSectionsByModule(module.id);
          
          // Filter hidden sections for non-admin users
          if (!isAdmin) {
            sections = sections.filter(s => s.isVisible !== false);
          }
          // Temat bez wykładu i pytań to ślad po imporcie (np. pusta sekcja zbiorcza), nie pozycja na liście
          sections = sections.filter(s => qBySection.has(s.id) || chBySection.has(s.id));

          // Add progress to each section
          const sectionsWithProgress = sections.map(section => {
            const progress = userProgress.find(p => p.sectionId === section.id);
            return {
              ...section,
              completionPercentage: progress ? parseFloat(progress.completionPercentage) : 0,
              lastActivity: progress?.lastActivity,
              questionCount: qBySection.get(section.id) ?? 0,
              chapterCount: chBySection.get(section.id) ?? 0,
              // Ostatnio otwarty rozdział (od 1) i liczba rozdziałów w chwili czytania; null = nie czytano
              lastChapter: readBySection.get(section.id)?.chapterOrder ?? null,
              chaptersTotal: readBySection.get(section.id)?.chaptersTotal ?? null,
            };
          });
          
          // Calculate module completion percentage
          // Postęp liczymy z odpowiedzi, więc tylko sekcje, które mają pytania —
          // inaczej sekcje z samym wykładem trzymałyby moduł wiecznie poniżej 100%
          const gradable = sectionsWithProgress.filter((s) => s.questionCount > 0);
          const moduleCompletion = gradable.length > 0
            ? gradable.reduce((acc, section) => acc + (section.completionPercentage || 0), 0) / gradable.length
            : 0;
          
          // Treść podsumowania i bibliografii ma własną trasę (/api/szkolenie/moduly/:id); tu tylko, czy są
          const { summaryMd, bibliographyMd, ...bezTresci } = module;
          return {
            ...bezTresci,
            hasSummary: !!summaryMd?.trim(),
            hasBibliography: !!bibliographyMd?.trim(),
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

  // ── Miejsce w wykładzie (wznowienie czytania) ─────────────────────────────
  const lectureReadSchema = z.object({
    chapterOrder: z.number().int().min(1).max(1000),
    chaptersTotal: z.number().int().min(1).max(1000),
  }).refine((d) => d.chapterOrder <= d.chaptersTotal, { message: "chapterOrder > chaptersTotal", path: ["chapterOrder"] });
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  app.get("/api/lecture-reads", requireKonto, async (req, res) => {
    try {
      const rows = await storage.getLectureReads(req.user!.id);
      res.json(rows.map((r) => ({
        sectionId: r.sectionId,
        chapterOrder: r.chapterOrder,
        chaptersTotal: r.chaptersTotal,
        updatedAt: r.updatedAt,
      })));
    } catch (error) {
      console.error("Lecture reads fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania miejsca w wykładach" });
    }
  });

  app.put("/api/lecture-reads/:sectionId", requireKonto, async (req, res) => {
    const { sectionId } = req.params;
    if (!UUID_RE.test(sectionId)) {
      return res.status(400).json({ error: "Nieprawidłowy identyfikator sekcji" });
    }
    const parsed = lectureReadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Nieprawidłowe dane", details: parsed.error.flatten() });
    }
    try {
      const row = await storage.upsertLectureRead(req.user!.id, sectionId, parsed.data.chapterOrder, parsed.data.chaptersTotal);
      // Szkolenie z punktami: pierwsze otwarcie i ukończenie wykładu (liczba rozdziałów z bazy)
      zapiszCzytanie(req.user!.id, sectionId, parsed.data.chapterOrder)
        .catch((e) => console.error("[szkolenie] zapis czytania:", e?.message));
      res.json({ sectionId: row.sectionId, chapterOrder: row.chapterOrder, chaptersTotal: row.chaptersTotal, updatedAt: row.updatedAt });
    } catch (error: any) {
      // Klucz obcy: nie ma takiej sekcji
      const code = error?.code ?? error?.cause?.code;
      if (code === "23503") {
        return res.status(404).json({ error: "Sekcja nie znaleziona" });
      }
      console.error("Lecture read save error:", error);
      res.status(500).json({ error: "Błąd podczas zapisywania miejsca w wykładzie" });
    }
  });

  // Get sections with user progress (legacy endpoint)
  app.get("/api/sections", requireKonto, async (req, res) => {
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

  app.get("/api/quiz/question", requireKonto, requireActiveSubscription, async (req, res) => {
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
  app.post("/api/exam/initialize", requireKonto, requireActiveSubscription, async (req, res) => {
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

  app.get("/api/exam/question", requireKonto, requireActiveSubscription, async (req, res) => {
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

  app.post("/api/exam/answer", requireKonto, requireActiveSubscription, async (req, res) => {
    try {
      const { sessionId, questionId, selectedIndex, timeMs, answerData } = req.body;

      if (!sessionId || typeof questionId !== 'string' || typeof timeMs !== 'number' || odpowiedzZaDuza(answerData)) {
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
      res.status(400).json({ error: bladDlaKlienta(error, "Błąd podczas zapisywania odpowiedzi") });
    }
  });

  app.get("/api/exam/summary", requireKonto, requireActiveSubscription, async (req, res) => {
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

  app.post("/api/quiz/answer", requireKonto, requireActiveSubscription, async (req, res) => {
    try {
      const { questionId, selectedIndex, timeMs, mode = "learn", answerData } = req.body;

      if (typeof questionId !== 'string' || typeof timeMs !== 'number' || odpowiedzZaDuza(answerData)) {
        return res.status(400).json({ error: "Nieprawidłowe dane" });
      }

      // For interactive question types, answerData is required
      // For multiple choice, selectedIndex is required
      if (answerData === undefined && typeof selectedIndex !== 'number') {
        return res.status(400).json({ error: "Nieprawidłowe dane odpowiedzi" });
      }

      // kursant ocenia tylko opublikowane pytania z widocznych sekcji i modułów (szkic zdradziłby odpowiedź)
      if (!["owner", "admin", "reviewer"].includes(req.user!.role)) {
        if (!/^[0-9a-f-]{36}$/i.test(questionId)) return res.status(404).json({ error: "Nie znaleziono pytania" });
        const [dostepne] = await db.select({ id: questions.id }).from(questions)
          .innerJoin(sections, eq(sections.id, questions.sectionId))
          .innerJoin(modules, eq(modules.id, sections.moduleId))
          .where(and(eq(questions.id, questionId), eq(questions.status, "published"), eq(questions.pool, "practice"), eq(sections.isVisible, true), eq(modules.isVisible, true)));
        if (!dostepne) return res.status(404).json({ error: "Nie znaleziono pytania" });
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

      // Szkolenie z punktami: opanowany temat mógł właśnie ukończyć moduł (gdy ćwiczenia są wymagane)
      poOdpowiedzi(req.user!.id).catch((e) => console.error("[szkolenie] po odpowiedzi:", e?.message));

      res.json({
        ...result,
        gamification: gamificationResult
      });
    } catch (error: any) {
      console.error("Answer submission error:", error);
      res.status(400).json({ error: bladDlaKlienta(error, "Błąd podczas zapisywania odpowiedzi") });
    }
  });

  app.get("/api/progress", requireKonto, async (req, res) => {
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

  app.get("/api/review-queue", requireKonto, requireActiveSubscription, async (req, res) => {
    try {
      const reviewQuestions = await quizService.getReviewQueue(req.user!.id);
      res.json({ questionIds: reviewQuestions });
    } catch (error) {
      console.error("Review queue error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania kolejki powtórek" });
    }
  });

  // Certificate endpoints
  app.get("/api/certificates/eligibility", requireKonto, async (req, res) => {
    try {
      const { mastered, required, isEligible } = await certificateService.getCompletion(req.user!.id);
      const user = await storage.getUser(req.user!.id);
      res.json({
        isEligible,
        masteredSections: mastered,
        requiredSections: required,
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        // certyfikat wymaga potwierdzonego adresu (certificateService.generateCertificate)
        emailVerified: !!user?.emailVerified,
        email: user?.email ?? "",
      });
    } catch (error) {
      console.error("Certificate eligibility error:", error);
      res.status(500).json({ error: "Błąd podczas sprawdzania uprawnień" });
    }
  });

  app.get("/api/certificates/my", requireKonto, async (req, res) => {
    try {
      const certificates = await storage.getUserCertificates(req.user!.id);
      res.json(certificates);
    } catch (error) {
      console.error("My certificates error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania certyfikatów" });
    }
  });

  app.post("/api/certificates/generate", requireKonto, async (req, res) => {
    try {
      const parsed = certificateNameSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Sprawdź imię i nazwisko" });
      }
      const { firstName, lastName } = parsed.data;
      const result = await certificateService.generateCertificate(
        req.user!.id,
        firstName && lastName ? { firstName, lastName } : undefined,
      );
      res.json(result);
    } catch (error: any) {
      console.error("Certificate generation error:", error);
      res.status(400).json({ error: bladDlaKlienta(error, "Błąd podczas generowania certyfikatu") });
    }
  });

  // ====== GAMIFICATION ENDPOINTS ======
  
  // Pobierz statystyki użytkownika (XP, poziom, streak)
  app.get("/api/gamification/stats", requireKonto, async (req, res) => {
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
  app.get("/api/gamification/activity-heatmap", requireKonto, async (req, res) => {
    try {
      const activities = await gamificationService.getUserActivityHeatmap(req.user!.id);
      res.json(activities);
    } catch (error) {
      console.error("Activity heatmap error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania heatmapy aktywności" });
    }
  });

  // Pobierz osiągnięcia użytkownika
  app.get("/api/gamification/achievements", requireKonto, async (req, res) => {
    try {
      const achievements = await gamificationService.getUserAchievements(req.user!.id);
      res.json(achievements);
    } catch (error) {
      console.error("Achievements error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania osiągnięć" });
    }
  });

  // Użyj streak freeze
  app.post("/api/gamification/use-freeze", requireKonto, async (req, res) => {
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

  // Admin endpoints
  app.get("/api/admin/questions", requireKonto, requireReviewer, async (req, res) => {
    try {
      const { status, sectionId } = req.query;
      
      let questions;
      if (sectionId) {
        questions = await storage.getQuestionsBySection(sectionId as string, status as string, { pula: "wszystkie" });
      } else {
        // Get all questions across all sections
        const sections = await storage.getSections();
        const allQuestions = [];
        for (const section of sections) {
          const sectionQuestions = await storage.getQuestionsBySection(section.id, status as string, { pula: "wszystkie" });
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

  app.post("/api/admin/questions", requireKonto, requireReviewer, async (req, res) => {
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

  app.put("/api/admin/questions/:id", requireKonto, requireReviewer, async (req, res) => {
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

  app.post("/api/admin/questions/:id/review", requireKonto, requireReviewer, async (req, res) => {
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
  app.delete("/api/admin/questions/:id", requireKonto, requireReviewer, async (req, res) => {
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
  app.post("/api/admin/questions/bulk", requireKonto, requireReviewer, async (req, res) => {
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
  app.get("/api/admin/modules", requireKonto, requireReviewer, async (req, res) => {
    try {
      const modules = await storage.getModulesWithSections();
      res.json(modules);
    } catch (error) {
      console.error("Admin modules fetch error:", error);
      res.status(500).json({ error: "Błąd podczas pobierania modułów" });
    }
  });

  app.post("/api/admin/modules", requireKonto, requireReviewer, async (req, res) => {
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

  app.put("/api/admin/modules/:id", requireKonto, requireReviewer, async (req, res) => {
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

  app.delete("/api/admin/modules/:id", requireKonto, requireReviewer, async (req, res) => {
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
  app.post("/api/admin/sections", requireKonto, requireReviewer, async (req, res) => {
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

  app.put("/api/admin/sections/:id", requireKonto, requireReviewer, async (req, res) => {
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

  app.delete("/api/admin/sections/:id", requireKonto, requireReviewer, async (req, res) => {
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
  app.put("/api/admin/modules/reorder", requireKonto, requireReviewer, async (req, res) => {
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
  app.put("/api/admin/sections/reorder", requireKonto, requireReviewer, async (req, res) => {
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


  // Public file serving endpoint

  // Object entity serving endpoint

  // Support endpoints

  // Admin endpoints for user management
  app.get("/api/admin/users", requireKonto, requireUserViewer, async (req, res) => {
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

  app.get("/api/admin/stats/users", requireKonto, requireUserViewer, async (req, res) => {
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
  app.post("/api/admin/users", requireKonto, requireOwner, async (req, res) => {
    try {
      const parsed = adminCreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: `Email, hasło (co najmniej ${PASSWORD_MIN_LENGTH} znaków), imię i nazwisko są wymagane; rola musi być prawidłowa` });
      }
      const { email, password, firstName, lastName, role } = parsed.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Użytkownik o tym adresie email już istnieje" });
      }

      const hashedPassword = await authService.hashPassword(password);

      // Create user
      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          emailVerified: true, // konto zakłada właściciel, adres uznajemy za potwierdzony
          emailVerifiedAt: new Date(),
          // konto kursanta (np. testowe do pentestu) ma dostęp jak tester bety
          testerBety: role === "student",
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

  app.put("/api/admin/users/:id", requireKonto, requireAdmin, async (req, res) => {
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
        // Role nadaje i odbiera tylko właściciel: support (dostęp bez płatności) i recenzent (dane kursantów)
        // też dają uprawnienia, których admin sam nie ma, więc admin nie może ich rozdawać, np. własnemu drugiemu kontu
        if (!actorIsOwner) {
          return res.status(403).json({ error: "Role nadaje i odbiera tylko właściciel" });
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

  // Usunięcie konta z danymi (RODO, także na prośbę użytkownika). Admin i właściciel; konta admin/owner tylko właściciel.
  app.delete("/api/admin/users/:id", requireKonto, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const actor = req.user!;
      if (actor.id === id) {
        return res.status(403).json({ error: "Własne konto usuwasz w ustawieniach konta" });
      }
      const target = await storage.getUser(id);
      if (!target) return res.status(404).json({ error: "Użytkownik nie znaleziony" });
      if (PRIVILEGED_ROLES.includes(target.role) && actor.role !== "owner") {
        return res.status(403).json({ error: "Konta administratorów i właścicieli usuwa tylko właściciel" });
      }
      if (target.role === "owner") {
        const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, "owner"));
        if (Number(row?.n ?? 0) <= 1) return res.status(409).json({ error: "Nie można usunąć ostatniego właściciela" });
      }
      const powiadom = req.body?.powiadom !== false;

      await usunKontoZDanymi(target, {
        actorId: actor.id,
        akcja: "account_deleted_by_admin",
        ip: req.ip,
        ua: req.get("User-Agent"),
      });
      if (powiadom) {
        emailService.sendAccountDeleted(target.email, target.firstName)
          .catch((e) => console.error("Failed to send account deletion email:", e?.message));
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Admin account deletion error:", error?.message);
      if (error?.code === "23503" || error?.cause?.code === "23503") {
        return res.status(409).json({ error: "To konto jest autorem treści kursu (pytania, rozdziały). Najpierw przepisz autorstwo" });
      }
      res.status(500).json({ error: "Błąd podczas usuwania konta" });
    }
  });

  // Zgody konta (dokument, wersja, data) do wglądu w panelu
  app.get("/api/admin/users/:id/zgody", requireKonto, requireAdmin, async (req, res) => {
    try {
      const rows = await db.select().from(userConsents).where(eq(userConsents.userId, req.params.id)).orderBy(desc(userConsents.acceptedAt));
      res.json(rows.map((r) => ({ document: r.document, version: r.version, acceptedAt: r.acceptedAt })));
    } catch (error: any) {
      console.error("Consents fetch error:", error?.message);
      res.status(500).json({ error: "Błąd podczas pobierania zgód" });
    }
  });

  // Przełączniki aplikacji (rejestracja, dokumenty, wyjątki limitów dla pentestu): tylko właściciel
  app.get("/api/admin/ustawienia", requireKonto, requireOwner, async (_req, res) => {
    res.json({
      ...(await wszystkieUstawienia()),
      // z konfiguracji serwera, w panelu tylko do odczytu
      platnosci: platnosciWlaczone(),
      indeksowanie: indeksowanieWlaczone(),
    });
  });

  app.put("/api/admin/ustawienia", requireKonto, requireOwner, async (req, res) => {
    const klucz = req.body?.klucz as KluczUstawienia;
    if (typeof klucz !== "string" || !Object.hasOwn(USTAWIENIA, klucz)) {
      return res.status(400).json({ error: "Nieznane ustawienie" });
    }
    try {
      await zapiszUstawienie(klucz, req.body?.wartosc, req.user!.id);
      await storage.createAuditLog({
        actorId: req.user!.id,
        action: "setting_changed",
        entityType: "setting",
        entityId: NIL_UUID,
        diff: { klucz, wartosc: req.body?.wartosc },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      });
      res.json(await wszystkieUstawienia());
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Nie udało się zapisać ustawienia" });
    }
  });

  // Grant/revoke subscription for user — tylko owner/support
  app.post("/api/admin/users/:id/subscription", requireKonto, requireSubscriptionManager, async (req, res) => {
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
            // plan techniczny do dostępu nadanego ręcznie: niewidoczny w cenniku i niedostępny w kasie
            isActive: false,
          }).returning();
          planId = newPlan.id;
        } else {
          planId = manualPlan[0].id;
        }

        // poprzedni dostęp nadany ręcznie zastępujemy; opłacone zostają (dostęp liczy się z najdłuższego)
        await db.update(subscriptions)
          .set({ status: "cancelled" })
          .where(and(
            eq(subscriptions.userId, id),
            eq(subscriptions.status, "active"),
            eq(subscriptions.paymentProvider, "manual")
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
        // Odebranie dostępu kończy też odnawianie w Stripe, żeby karta nie była dalej obciążana
        const odnawiane = await db.select({ s: subscriptions.stripeSubscriptionId }).from(subscriptions)
          .where(and(eq(subscriptions.userId, id), eq(subscriptions.status, "active"), sql`${subscriptions.stripeSubscriptionId} IS NOT NULL`));
        await anulujWStripe(odnawiane.map((o) => o.s!));
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
  app.get("/api/admin/support/tickets", requireKonto, requireReviewer, async (req, res) => {
    try {
      const { status, search } = req.query;
      let query = db.select().from(supportTickets);

      // Zgłoszenia z bety i błędy w pytaniach mają własną zakładkę „Zgłoszenia” — tu tylko wiadomości do supportu
      // „Do prowadzącego” (moduły szkolenia) też tu: to wiadomości, na które ktoś odpowiada
      const ticketConditions: any[] = [or(eq(supportTickets.kind, "support"), eq(supportTickets.kind, "prowadzacy")), sql`${supportTickets.questionId} IS NULL`];
      
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

  app.get("/api/admin/stats/support", requireKonto, requireReviewer, async (req, res) => {
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

  app.put("/api/admin/support/tickets/:id", requireKonto, requireReviewer, async (req, res) => {
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
  app.get("/api/admin/analytics/stats", requireKonto, requireReviewer, async (req, res) => {
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

  app.get("/api/admin/analytics/performance", requireKonto, requireReviewer, async (req, res) => {
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
  app.get("/api/admin/sections/:sectionId/chapters", requireKonto, requireReviewer, async (req, res) => {
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

  app.post("/api/admin/sections/:sectionId/chapters", requireKonto, requireReviewer, async (req, res) => {
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

  app.put("/api/admin/chapters/:id", requireKonto, requireReviewer, async (req, res) => {
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

  app.delete("/api/admin/chapters/:id", requireKonto, requireReviewer, async (req, res) => {
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


  // Public endpoints for lecture chapters
  app.get("/api/sections/:sectionId/chapters", requireKonto, requireActiveSubscription, async (req, res) => {
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

  // (Blog, pytanie demo i treść strony głównej z EKGQuiz usunięte 10.11.2026: blog jest na helloekg.pl,
  // treść kursu przychodzi ze studia.)

  // Report error/bug endpoint
  app.post("/api/report-error", requireKonto, async (req, res) => {
    try {
      const { questionId, message } = req.body;
      
      if (typeof questionId !== "string" || typeof message !== "string" || !questionId || !message.trim()) {
        return res.status(400).json({ error: "Pytanie i wiadomość są wymagane" });
      }
      if (!/^[0-9a-f-]{36}$/i.test(questionId) || message.length > 5000) {
        return res.status(400).json({ error: "Wiadomość może mieć najwyżej 5000 znaków" });
      }
      if (!(await storage.getQuestionById(questionId))) {
        return res.status(404).json({ error: "Nie znaleziono pytania" });
      }
      // najwyżej 20 zgłoszeń błędów na dobę z jednego konta
      const [{ n: dzis }] = await db.select({ n: count() }).from(supportTickets)
        .where(and(eq(supportTickets.userId, req.user!.id), sql`${supportTickets.questionId} IS NOT NULL`, sql`${supportTickets.createdAt} > now() - interval '24 hours'`));
      if (Number(dzis) >= 20) {
        return res.status(429).json({ error: "Wysłano dziś już 20 zgłoszeń z tego konta. Kolejne możesz wysłać jutro." });
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
  (await import("./learningAnalyticsRoutes")).registerLearningAnalyticsRoutes(app); // panel nauki (admin → Statystyki)
  (await import("./szkolenie/trasy")).registerSzkolenieRoutes(app); // szkolenie z punktami edukacyjnymi

  // Nieznany adres API: 404 w JSON (nie strona aplikacji z kodem 200)
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Nie znaleziono" });
  });
  const httpServer = createServer(app);
  return httpServer;
}
