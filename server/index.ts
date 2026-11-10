// Config validation must run first — exits with clear message if env vars are missing
import "./config";
import { config } from "./config";
import "./logBezDanych";

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import crypto from "crypto";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { stripeStatus } from "./stripeClient";
import { obsluzZdarzenieStripe } from "./webhookHandlers";
import { applySecurityHeaders } from "./middleware/security";
import { csrfOriginCheck } from "./middleware/csrf";

// ---------------------------------------------------------------------------
// Unhandled rejection / uncaught exception safety net
// These prevent the process from dying silently.
// ---------------------------------------------------------------------------
process.on("uncaughtException", (err: Error) => {
  console.error("[fatal] Uncaught exception — shutting down:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[fatal] Unhandled promise rejection — shutting down:", reason);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();

// Gzip/Brotli compression for all responses
app.use(compression());

// Security headers (CSP egzekwowana w produkcji, szczegóły w middleware/security.ts)
applySecurityHeaders(app);

// CSRF: żądania zmieniające stan do /api tylko z naszego originu (webhooki Stripe — wyjątek, podpis)
app.use(csrfOriginCheck);

// Webhook Stripe potrzebuje surowej treści (podpis): przed express.json().
// Adres ustawiany w panelu Stripe: /api/stripe/webhook/manual, sekret podpisu w STRIPE_WEBHOOK_SECRET.
// Działa także przy wyłączonych płatnościach (PLATNOSCI_WLACZONE), żeby dało się testować tryb testowy.
app.post(
  "/api/stripe/webhook/manual",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set — manual webhook is disabled");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature header" });

    let event: any;
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const sig = Array.isArray(signature) ? signature[0] : signature;
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (error: any) {
      console.error("Stripe webhook: zły podpis albo treść:", error.message);
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    try {
      const wynik = await obsluzZdarzenieStripe(event);
      console.log(`Stripe webhook ${event.type} ${event.id}: ${wynik}`);
      res.status(200).json({ received: true });
    } catch (error: any) {
      // 500: Stripe ponowi wysyłkę, a zdarzenie nie jest zapisane jako obsłużone
      console.error(`Stripe webhook ${event.type} ${event.id}: błąd obsługi:`, error?.message);
      res.status(500).json({ error: "Webhook processing error" });
    }
  }
);

app.use(express.json());
// Bez express.urlencoded: aplikacja nie przyjmuje formularzy HTML (same JSON-y z fetch),
// a urlencoded to „prosty” content-type, który obcy formularz może wysłać bez preflightu.

// Grafiki kursu (/content-assets) serwuje server/routes.ts: dopiero za sesją, tylko dla potwierdzonych kont.

// ---------------------------------------------------------------------------
// Correlation ID — attach a unique request ID to every request/response
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  // Przyjmujemy cudzy X-Request-ID tylko w bezpiecznym formacie (bez wstrzykiwania do logów/nagłówków)
  const incoming = req.headers["x-request-id"];
  const id =
    typeof incoming === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(incoming)
      ? incoming
      : crypto.randomBytes(8).toString("hex");
  (req as any).correlationId = id;
  res.setHeader("X-Request-ID", id);
  next();
});

// ---------------------------------------------------------------------------
// Structured request logger (no response bodies — avoids PII in logs)
// ---------------------------------------------------------------------------
const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key"]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const correlationId = (req as any).correlationId as string;

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    log(
      `[${correlationId}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`,
      level
    );
  });

  next();
});

// Stan konfiguracji Stripe w logu przy starcie (bez wartości kluczy)
console.log(stripeStatus());

// ---------------------------------------------------------------------------
// Application routes + server startup
// ---------------------------------------------------------------------------
(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    // 4xx (np. zły JSON) bez obiektu błędu: body-parser trzyma w nim surową treść żądania
    if (status >= 500) console.error(`[error] ${status} - ${message}`, err);
    else console.warn(`[error] ${status} - ${err.type || message}`);
    res.status(status).json({
      message: config.isProduction && status === 500 ? "Internal Server Error" : message,
    });
  });

  if (!config.isProduction) {
    // vite tylko w podglądzie lokalnym: na produkcji nie jest nawet zainstalowany (npm ci --omit=dev)
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Domyślnie tylko loopback — produkcja stoi za Caddy na tym samym hoście. HOST=0.0.0.0, jeśli trzeba inaczej.
  // reusePort działa tylko na Linuksie — na macOS (lokalny podgląd) listen kończy się ENOTSUP
  const host = process.env.HOST || "127.0.0.1";
  server.listen({ port: config.port, host, reusePort: process.platform === "linux" }, () => {
    log(`serving on ${host}:${config.port}`);
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown — SIGTERM / SIGINT
  // Stops accepting new connections, drains in-flight requests, closes DB pool.
  // ---------------------------------------------------------------------------
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n[shutdown] ${signal} received — draining connections...`);

    // Hard kill after 10 s if graceful shutdown stalls
    const forceExit = setTimeout(() => {
      console.error("[shutdown] Timeout — forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async () => {
      console.log("[shutdown] HTTP server closed");
      try {
        const { pool } = await import("./db");
        await pool.end();
        console.log("[shutdown] DB pool closed");
      } catch (err) {
        console.error("[shutdown] Error closing DB pool:", err);
      }
      clearTimeout(forceExit);
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
