import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Neon (Replit) mówi przez WebSocket; zwykły Postgres (VPS) przez TCP.
const isNeon = /neon\.tech/.test(process.env.DATABASE_URL);

// Pula Neona ma API zgodne z pg.Pool — typujemy wspólnie jako pg.Pool
let pool: pg.Pool;
let db: ReturnType<typeof drizzleNeon<typeof schema>>;

if (isNeon) {
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL }) as unknown as pg.Pool;
  db = drizzleNeon({ client: pool as unknown as NeonPool, schema });
} else {
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  db = drizzlePg({ client: pool, schema }) as unknown as typeof db;
}

export { pool, db };
