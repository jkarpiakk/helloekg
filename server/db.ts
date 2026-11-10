import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// PostgreSQL na VPS (TCP). Pula Neona (Replit) usunięta 10.11.2026.
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const db = drizzle({ client: pool, schema });

export { pool, db };
