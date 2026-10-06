# Tablor's

Restaurant technology platform: marketing site, Restaurant Owner
Dashboard, Kitchen Display System, physical table-ordering devices,
live orders, billing, device monitoring, and Company Admin Dashboard.

Greenfield project. See `docs/architecture.md` for the system design
and `docs/open-decisions.md` for everything intentionally left
unconfirmed (hardware specs, protocol, business rules).

## Status: V1 demo build complete

- [x] Public landing page (Phase 1 — navbar, hero, product intro,
      ordering steps, features, business types, pricing, demo form,
      contact, footer, legal placeholders, SEO)
- [x] Owner dashboard: overview KPIs, menu + availability, table floor
      map, live orders, billing (GST/discount/service charge +
      cash/UPI/card), device monitoring, basic reports
- [x] Kitchen Display System: NEW/PREPARING/READY, large action buttons
- [x] Company Admin: demo-request leads, device registry
- [x] Demo login for all three roles (see credentials below)

**This is a demo build, not production-ready.** It runs on an
in-memory data store (`src/server/modules/demo-store`) instead of
Postgres, and demo auth (`src/server/modules/auth/demo-auth.ts`)
instead of the real Argon2id + DB-backed session system. Both are
clearly labeled in code and swapped out wholesale in Phase 2 — no
rewrite of the pages themselves. Data resets on server restart.

### Demo logins
| Role | Username | Password | URL |
| --- | --- | --- | --- |
| Owner | `owner` | `demo-owner` | `/owner` |
| Kitchen | `kitchen` | `demo-kitchen` | `/kitchen` |
| Admin | `admin` | `demo-admin` | `/admin` |

- [ ] Phase 2: real database, Argon2id auth, RBAC, tenant isolation
- [ ] Phase 3–7: see `docs/architecture.md`

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values — never commit this file
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest unit tests |
| `npm run format` | Prettier write |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |

## Conventions

- No hardcoded pricing, contact details, or business rules — use
  `src/lib/config.ts` and the database.
- Money is stored as integer paise. Timestamps are stored in UTC and
  displayed in IST.
- Every protected route is server-authorized; the client never sets
  authoritative prices, availability, or order status.
- Commits follow Conventional Commits.
