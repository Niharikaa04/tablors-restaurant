import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is empty"); process.exit(1); }

const u = new URL(url);
console.log("host:", u.hostname, "port:", u.port, "user:", u.username, "db:", u.pathname);

const sql = postgres(url, { max: 1, connect_timeout: 10, ssl: "require" });
try {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`;
  console.log(`public tables (${tables.length}):`, tables.map(t => t.table_name).join(", "));

  const enums = await sql`
    select t.typname from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e' order by 1`;
  console.log(`enums (${enums.length}):`, enums.map(e => e.typname).join(", "));

  const rls = await sql`
    select relname, relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by 1`;
  console.log("RLS enabled:", rls.map(r => `${r.relname}=${r.relrowsecurity}`).join(", "));
} catch (e) {
  console.error("FAILED:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}