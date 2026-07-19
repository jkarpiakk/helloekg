import helmet from "helmet";
import type { Express } from "express";

/**
 * Applies security headers to every response.
 *
 * CSP NOTE: The Content-Security-Policy is intentionally run in REPORT-ONLY
 * mode so it never breaks the running application. Review violations in the
 * server logs (or set a report-uri endpoint) and tighten the policy once you
 * know which sources are legitimately needed.
 *
 * Headers that ARE enforced (non-breaking):
 *   - Strict-Transport-Security (HSTS)
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: DENY
 *   - Referrer-Policy: strict-origin-when-cross-origin
 *   - Permissions-Policy (restricts camera/mic/geo)
 *
 * What the CSP report-only policy allows — tighten once you audit violations:
 *   - script-src: 'self' + Stripe (js.stripe.com)
 *   - style-src: 'self' + 'unsafe-inline' + Google Fonts
 *   - font-src: 'self' + Google Fonts CDN
 *   - frame-src: Stripe checkout iframes
 *   - connect-src: 'self' + Stripe API + WebSocket (Vite HMR in dev)
 *   - img-src: 'self' + data URIs + all HTTPS (for ECG images from object storage)
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

  // CSP in REPORT-ONLY mode — adjust these directives after auditing violations
  const cspDirectives = [
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
  ].join("; ");

  app.use((_req, res, next) => {
    res.setHeader("Content-Security-Policy-Report-Only", cspDirectives);
    next();
  });
}
