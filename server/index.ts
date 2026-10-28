// Config validation must run first — exits with clear message if env vars are missing
import "./config";
import { config } from "./config";

import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import crypto from "crypto";
import { runMigrations } from "stripe-replit-sync";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getStripeSync, stripeSource, stripeStatus } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
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

// Security headers (CSP in report-only mode; other headers enforced)
applySecurityHeaders(app);

// CSRF: żądania zmieniające stan do /api tylko z naszego originu (webhooki Stripe — wyjątek, podpis)
app.use(csrfOriginCheck);

// Stripe webhooks need the raw body — mount before express.json()
// Webhook ustawiany w panelu Stripe (podpis STRIPE_WEBHOOK_SECRET). Musi stać przed trasą /:uuid,
// bo inaczej „manual” trafia tam jako uuid zarządzanego webhooka Replita.
app.post(
  "/api/stripe/webhook/manual",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set — manual webhook is disabled");
      return res.status(500).json({ error: "Webhook not configured" });
    }
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature header" });

    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const sig = Array.isArray(signature) ? signature[0] : signature;
      const event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
      console.log(`Manual webhook received: ${event.type}`);
      // płatność kartą: completed od razu jako paid; metody odroczone (np. przelew): async_payment_succeeded
      if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
        await WebhookHandlers.handleCheckoutCompleted(event.data.object);
      }
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Manual webhook error:", error.message);
      res.status(400).json({ error: "Invalid webhook signature or processing error" });
    }
  }
);

// Zarządzany webhook stripe-replit-sync: tylko z konektorem Replit
app.post(
  "/api/stripe/webhook/:uuid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (stripeSource() !== "replit") return res.status(404).json({ error: "Not found" });
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error("STRIPE WEBHOOK ERROR: req.body is not a Buffer");
        return res.status(500).json({ error: "Webhook processing error" });
      }
      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error.message);
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

app.use(express.json());
// Bez express.urlencoded: aplikacja nie przyjmuje formularzy HTML (same JSON-y z fetch),
// a urlencoded to „prosty” content-type, który obcy formularz może wysłać bez preflightu.

// Grafiki kursu zaimportowane ze studia (paczka eksportu → katalog na dysku)
if (process.env.CONTENT_ASSETS_DIR) {
  app.use(
    "/content-assets",
    express.static(process.env.CONTENT_ASSETS_DIR, { maxAge: "7d", immutable: true, fallthrough: false })
  );
}

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

// ---------------------------------------------------------------------------
// Stripe initialisation — fire-and-forget so it never blocks startup
// ---------------------------------------------------------------------------
function initStripe(): void {
  if (!config.databaseUrl) return;
  // Stan konfiguracji w logu (bez wartości kluczy). Poza Replitem klucze idą ze zmiennych serwera,
  // a webhook ustawia się w panelu Stripe na /api/stripe/webhook/manual: bez migracji i synchronizacji.
  console.log(stripeStatus());
  if (stripeSource() !== "replit") return;

  (async () => {
    try {
      console.log("Initializing Stripe schema...");
      await runMigrations({ databaseUrl: config.databaseUrl });
      console.log("Stripe schema ready");

      const stripeSync = await getStripeSync();

      // Use APP_BASE_URL instead of REPLIT_DOMAINS so this works outside Replit
      const webhookBaseUrl = config.appBaseUrl;
      const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
        { enabled_events: ["*"], description: "Managed webhook for Stripe sync" }
      );
      console.log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`);

      stripeSync
        .syncBackfill()
        .then(() => console.log("Stripe data synced"))
        .catch((err: any) => console.error("Error syncing Stripe data:", err));
    } catch (error) {
      console.error("Failed to initialize Stripe (non-fatal):", error);
    }
  })();
}

// Start Stripe in background — startup continues immediately regardless
initStripe();

// ---------------------------------------------------------------------------
// Application routes + server startup
// ---------------------------------------------------------------------------
(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status} - ${message}`, err);
    res.status(status).json({
      message: config.isProduction && status === 500 ? "Internal Server Error" : message,
    });
  });

  if (!config.isProduction) {
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
