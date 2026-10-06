# Phase 2 — Database Foundation

This phase adds the PostgreSQL/Drizzle foundation without replacing the existing UI.

## What changed

- Expanded `src/server/db/schema.ts` from the notification-only schema into the core V1 database schema.
- Added tenant-aware tables for:
  - restaurants and users/sessions
  - areas and restaurant tables
  - menu categories/items
  - table sessions
  - devices and device heartbeats
  - orders, order items, and order events
  - reservations
  - bills and payments
  - waiter calls
  - leads and audit log
  - existing notifications/preferences
- Money is stored as integer paise.
- Timestamps are stored with timezone information and should be written in UTC.
- IDs remain text-compatible with the existing demo IDs so the migration can be incremental.
- Added:
  - `npm run db:push`
  - `npm run db:generate`
  - `npm run db:seed`
- Added `DATABASE_URL` to `.env.example`.
- Added a seed script that copies the current demo records into PostgreSQL.

## Before running the seed

1. Create a PostgreSQL database.
2. Put its connection string in `.env.local`:

```env
DATABASE_URL=postgresql://...
```

3. Run:

```bash
npm install
npm run db:push
npm run db:seed
```

## Important

The application still reads from the Phase-1 demo store at this point.

The next implementation phase is the **repository migration**: replace the read/write calls in the menu, tables, orders, reservations, devices, billing, and customer actions with asynchronous Drizzle/Postgres calls.

Do not delete `src/server/modules/demo-store/` until each caller has been migrated and tested.
