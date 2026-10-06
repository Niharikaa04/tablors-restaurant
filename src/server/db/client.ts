import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Database client bootstrap.
 *
 * Phase 0: connection wiring only. The actual schema (restaurants,
 * users, menu, orders, billing, devices, future financial-pots, etc.)
 * lands in Phase 2 ("Database foundation"), per the phased plan.
 *
 * All money is stored as integer paise. All timestamps are stored in
 * UTC and converted to IST only at display time — see src/lib/time.ts
 * (added in Phase 2).
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== "test") {
  // Fail loudly in dev rather than silently connecting to nothing.
  console.warn(
    "[tablors:db] DATABASE_URL is not set. Copy .env.example to .env.local and configure it."
  );
}

const queryClient = postgres(connectionString ?? "", { max: 1 });
export const db = drizzle(queryClient);
