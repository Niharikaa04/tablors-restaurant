import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * Database client for Next.js on Vercel (serverless) + Supabase.
 *
 * Production notes:
 * - DATABASE_URL must be the Supabase *pooled* connection string
 *   (Transaction pooler, port 6543). Serverless functions open many short
 *   lived connections; the pooler multiplexes them. The direct 5432 URL is
 *   for migrations only (MIGRATION_DATABASE_URL).
 * - Transaction-mode poolers do not support prepared statements, so
 *   `prepare: false` is required.
 * - The client is cached on globalThis so dev hot-reloads and warm lambdas
 *   reuse one connection instead of leaking a new one per module load.
 * - postgres.js connects lazily, so importing this at build time is safe.
 *
 * All money is stored as integer paise. All timestamps are UTC.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  console.error(
    "[tablors:db] DATABASE_URL is not set. Set it in .env.local (local) or in the Vercel project environment variables (production).",
  );
}

// A host that can never resolve, so a missing URL fails with an obvious
// error instead of silently trying localhost:5432.
const url = connectionString ?? "postgres://missing-database-url@invalid.invalid:5432/missing";

function needsSsl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
}

const globalForDb = globalThis as unknown as {
  __tablorsPg?: ReturnType<typeof postgres>;
};

const queryClient =
  globalForDb.__tablorsPg ??
  (globalForDb.__tablorsPg = postgres(url, {
    // A few connections per serverless instance so queries that run together
    // (Promise.all on a page) really run in parallel instead of queueing on a
    // single connection; the Supabase pooler still does the sharing.
    max: process.env.VERCEL ? 3 : 5,
    prepare: false,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    ssl: needsSsl(url) ? "require" : false,
    onnotice: () => {},
  }));

export const db = drizzle(queryClient);

/** Cheap connectivity probe used by /api/health. */
export async function pingDatabase(): Promise<void> {
  await queryClient`select 1`;
}
