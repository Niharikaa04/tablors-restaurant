# Open Decisions & Unconfirmed Specifications

Per project rules: do not invent business requirements, pricing, or
hardware specs. This file tracks everything left open, pending
confirmation from the business/hardware team.

## Hardware (physical table ordering device)
The booklet/back-cover material gives *marketed* specs, but these are
product-listing copy, not confirmed engineering specs — treat as
provisional until verified against real hardware:
- Display: 7" TFT LCD, 800×480 — **provisional**
- Battery: rechargeable lithium, ~10–12h runtime, 3–4h charge — **provisional**
- Body: A4 (297×210mm) book-shape, PU leather hard cover — **provisional**
- MCU / connectivity (Wi-Fi chipset, etc.) — **not specified, open**

## Device communication protocol
- HTTPS polling vs MQTT vs WebSocket — **open**. Architecture uses a
  protocol adapter (`src/server/modules/devices`) so this can be
  decided later without a rewrite.
- Local menu storage / offline behavior on the device — **open**
- Heartbeat interval / offline threshold — defaulted in `.env.example`
  (30s / 90s) but **not confirmed**, kept configurable
- Credential provisioning flow for new devices — **open**
- Unavailable-item behavior on-device — **open**
- Menu synchronization strategy (push vs pull) — **open**

## Business rules
- GST rate(s), discount rules, service charge rules — **not implemented
  with hardcoded values**; billing module (Phase 5) will read these
  from restaurant settings, confirmed by business/accountant before
  launch
- Pricing tiers / subscription plans — **not invented**; placeholder
  fields only, sourced from `src/lib/config.ts` / DB, left blank
- Public contact phone/email — **left blank**, see `.env.example`

## Financial Pots & Salary Distribution
Deferred to a future phase. Before implementation:
- Business rules for allocation/salary calculation — **undefined**
- Gross vs taxable amount handling — **undefined**
- Accountant + legal review — **recommended, not done**

Architecture reserves a module boundary
(`src/server/modules/financial-pots`) and a `financialPotsConfig` flag
(default `false`) so this can be added later without restructuring
core restaurant/order/billing tables.
