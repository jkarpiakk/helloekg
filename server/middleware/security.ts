import helmet from "helmet";
import type { Express } from "express";

/**
 * Applies security headers to every response.
 *
 * Enforced: HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy
 * oraz w produkcji Content-Security-Policy (szczegóły przy dyrektywach niżej).
 */
export function applySecurityHeaders(app: Express) {
  // Standard security headers — all enforced
  app.use(
    helmet({
      // Disable helmet's built-in CSP; we set report-only below
      contentSecurityPolicy: false,
      // HSTS — only makes sense in production but harmless in dev
      strictTransportSecurity: {
        maxAge: 31_536_000,
        includeSubDomains: true,
        preload: false,
      },
      // Prevent MIME-type sniffing
      noSniff: true,
      // Block framing — change to 'SAMEORIGIN' if you ever embed your own pages
      frameguard: { action: "deny" },
      // Explicit referrer policy
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // Disable X-Powered-By
      hidePoweredBy: true,
      // XSS filter (legacy browsers)
      xssFilter: true,
      // Disable COEP for now — Stripe and Google Fonts need cross-origin resources
      crossOriginEmbedderPolicy: false,
    })
  );

  // Permissions-Policy — disable sensors and invasive APIs
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=(), payment=(self)"
    );
    next();
  });

  // CSP. Produkcja: egzekwowana (od 29.10.2026, po przejściu wszystkich ekranów kursu i panelu bez naruszeń).
  // Awaryjnie CSP_REPORT_ONLY=1 w konfiguracji serwera wraca do samego raportowania bez wdrożenia.
  // Dev (Vite): tylko raport, bo HMR wstrzykuje skrypty i łączy się przez WebSocket.
  // Jedyny skrypt w kodzie strony to ustawienie motywu w client/index.html: dopuszczony skrótem sha256,
  // więc każda zmiana tego skryptu wymaga nowego skrótu tutaj (inaczej motyw jasny migałby ciemnym).
  const THEME_SCRIPT_HASH = "'sha256-myuKX66eAooEW7qspcTXs13mZccTGoSRr4nY1ZmuBA4='";
  const isProduction = process.env.NODE_ENV === "production";
  const enforce = isProduction && process.env.CSP_REPORT_ONLY !== "1";

  const cspDirectives = (isProduction
    ? [
        "default-src 'self'",
        `script-src 'self' ${THEME_SCRIPT_HASH}`,
        // style: atrybuty style w treści wykładów (HTML z importu) i w komponentach
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        // grafiki kursu z /content-assets, załączniki zgłoszeń jako data:/blob:
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        // płatność: przekierowanie na checkout.stripe.com (window.location), nie formularz
        "form-action 'self'",
      ]
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://js.stripe.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:",
        "frame-src https://js.stripe.com",
        "connect-src 'self' https://api.stripe.com wss: ws:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self' https://js.stripe.com",
      ]
  ).join("; ");

  app.use((_req, res, next) => {
    res.setHeader(enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", cspDirectives);
    next();
  });
}
