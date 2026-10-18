/**
 * Safe migration runner for Tablor.
 *
 *   npm run db:migrate:safe
 *
 * - Reads the Drizzle journal and applies pending SQL files in order.
 * - Records applied files in public._tablor_migrations.
 * - BASELINE: if the database already has the core schema (for example it was
 *   created earlier with `drizzle-kit push`), 0000 is recorded as applied
 *   WITHOUT being executed, so nothing is re-created or touched.
 * - GUARD: every migration after the baseline is refused if it contains
 *   DROP, TRUNCATE or DELETE FROM. Migrations here must be additive.
 * - Each migration runs in one transaction: it fully applies or not at all.
 *
 * Use the DIRECT (port 5432) connection string for migrations:
 *   MIGRATION_DATABASE_URL (preferred) or DATABASE_URL.
 */
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Set MIGRATION_DATABASE_URL (direct, port 5432) or DATABASE_URL.");
  process.exit(1);
}

const dir = path.join(process.cwd(), "src/server/db/migrations");
const journal = JSON.parse(
  fs.readFileSync(path.join(dir, "meta/_journal.json"), "utf8"),
);

const host = new URL(url).hostname;
const local = host === "localhost" || host === "127.0.0.1";
const sql = postgres(url, {
  max: 1,
  connect_timeout: 15,
  ssl: local ? false : "require",
  onnotice: () => {},
});

const FORBIDDEN = /\b(DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i;

try {
  await sql`create table if not exists public._tablor_migrations (
    tag text primary key,
    applied_at timestamptz not null default now(),
    note text
  )`;

  const done = new Set(
    (await sql`select tag from public._tablor_migrations`).map((r) => r.tag),
  );

  for (const entry of journal.entries) {
    const tag = entry.tag;
    if (done.has(tag)) {
      console.log(`skip     ${tag} (already applied)`);
      continue;
    }

    const file = fs.readFileSync(path.join(dir, `${tag}.sql`), "utf8");

    if (entry.idx === 0) {
      const [{ exists }] = await sql`select to_regclass('public.restaurants') is not null as exists`;
      if (exists) {
        await sql`insert into public._tablor_migrations (tag, note) values (${tag}, 'baseline: schema already present, not executed')`;
        console.log(`baseline ${tag} (schema already present, NOT executed)`);
        continue;
      }
    } else if (FORBIDDEN.test(file.replace(/--.*$/gm, ""))) {
      console.error(`REFUSED  ${tag}: contains DROP/TRUNCATE/DELETE FROM. Migrations must be additive.`);
      process.exit(2);
    }

    const statements = file
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    await sql.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx`insert into public._tablor_migrations (tag) values (${tag})`;
    });
    console.log(`applied  ${tag} (${statements.length} statements)`);
  }

  console.log("Migrations up to date.");
} catch (err) {
  console.error("MIGRATION FAILED:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
