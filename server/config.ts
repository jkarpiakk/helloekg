/**
 * Startup configuration validation.
 * This module must be imported before any other server code.
 * It validates all required environment variables and exits with a clear
 * message if any are missing, instead of failing silently at runtime.
 */

interface ConfigError {
  variable: string;
  description: string;
}

const required: Array<{ name: string; description: string }> = [
  { name: "DATABASE_URL", description: "PostgreSQL connection string (provision a DB in Replit or set DATABASE_URL)" },
  { name: "SESSION_SECRET", description: "Session signing secret — generate with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"" },
];

const errors: ConfigError[] = [];

for (const { name, description } of required) {
  if (!process.env[name]) {
    errors.push({ variable: name, description });
  }
}

if (errors.length > 0) {
  console.error("\n=== FATAL: Missing required environment variables ===\n");
  for (const { variable, description } of errors) {
    console.error(`  ✗ ${variable}\n    → ${description}\n`);
  }
  console.error("Add these in the Replit Secrets tab (padlock icon in the sidebar).\n");
  process.exit(1);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  appBaseUrl: process.env.APP_BASE_URL || (
    process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
      : "http://localhost:5000"
  ),
  isProduction: process.env.NODE_ENV === "production",
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
};
