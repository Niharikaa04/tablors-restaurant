# Tablor's — Architecture Overview

Greenfield restaurant technology platform. See `docs/open-decisions.md`
for everything intentionally left unconfirmed.

## Stack
Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Motion
(motion/react) · PostgreSQL · Drizzle ORM · Zod · Argon2id · SSE ·
Vitest · Playwright · Docker.

## Surfaces (route groups under `src/app`)
- `(marketing)` — public site: hero, product intro, pricing, demo form
- `(auth)` — login/registration shells
- `owner` — Restaurant Owner Dashboard (RBAC: owner/manager/cashier)
- `kitchen` — Kitchen Display System (separate, restricted login)
- `admin` — Company Admin Dashboard (leads, restaurants, devices)
- `api` — route handlers, grouped by the module boundaries below

## Server module boundaries (`src/server/modules/*`)
auth · tenancy · restaurants · leads · menu · tables · orders ·
billing · devices · realtime · financial-pots (reserved, inactive in
V1). Modules avoid unnecessary coupling; cross-module calls go through
explicit exported functions, not shared mutable state.

## Data rules
- Every tenant-scoped row carries `restaurant_id`; Postgres
  Row-Level Security applied where appropriate.
- Money stored as integer paise, never floats.
- Timestamps stored in UTC, converted to IST (`Asia/Kolkata`) only at
  display time.
- Order/billing history is preserved (soft deletion, not hard
  deletion) where required.
- All prices, availability checks, and status transitions are
  server-authoritative — the client never sets a price.

## Devices
Physical table-ordering devices talk to the platform through a
protocol adapter in `src/server/modules/devices`, so the transport
(HTTPS/MQTT/WebSocket — see open decisions) can be swapped without
touching business logic. A device simulator (`tools/device-simulator`)
stands in for real hardware until it's available.

## Realtime
SSE for dashboard/kitchen updates where sufficient; WebSocket only
where genuinely required. All realtime connections are authenticated
and events are filtered by restaurant + role. Reconnection and
missed-event recovery are required, not optional.

## Security
Every protected route enforces server-side authorization and tenant
isolation. See the 31-item VAPT checklist tracked in
`docs/security-checklist.md` (added in Phase 7, referenced from
Phase 1 onward as controls are implemented).

## Phased plan
Phase 0 (this scaffold) → 1 (landing page) → 2 (DB/auth/RBAC/tenancy)
→ 3 (menu/codes/tables) → 4 (orders/realtime/KDS/simulator) → 5
(billing/payments/reports) → 6 (device monitoring/company admin) → 7
(security hardening/VAPT/deploy prep) → future (Financial Pots,
inventory, staff mgmt, multi-branch, etc.)
