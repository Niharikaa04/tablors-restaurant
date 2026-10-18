/**
 * End-to-end persistence test against a REAL PostgreSQL database.
 * Skipped unless TEST_DATABASE_URL is set. Use a scratch database only:
 *
 *   createdb tablor_test
 *   MIGRATION_DATABASE_URL=postgres://.../tablor_test npm run db:migrate:safe
 *   DATABASE_URL=postgres://.../tablor_test npm run db:seed
 *   TEST_DATABASE_URL=postgres://.../tablor_test npm test
 *
 * It creates its own rows (unique ids) and does not touch other data.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("database persistence and order-to-billing flow", () => {
  const R = "demo-restaurant";
  let tables: typeof import("@/server/modules/data/tables-db");
  let menu: typeof import("@/server/modules/data/menu-db");
  let orders: typeof import("@/server/modules/orders/db-orders");
  let billing: typeof import("@/server/modules/billing/db-billing");
  let resv: typeof import("@/server/modules/data/reservations-db");
  let notif: typeof import("@/server/modules/notifications/store");
  let docs: typeof import("@/server/modules/data/documents");
  let analytics: typeof import("@/server/modules/data/analytics-db");
  let activity: typeof import("@/server/modules/demo-store/table-activity");
  let settings: typeof import("@/server/modules/demo-store/settings");
  let staff: typeof import("@/server/modules/demo-store/staff");
  let tag: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    tag = Date.now().toString(36);
    tables = await import("@/server/modules/data/tables-db");
    menu = await import("@/server/modules/data/menu-db");
    orders = await import("@/server/modules/orders/db-orders");
    billing = await import("@/server/modules/billing/db-billing");
    resv = await import("@/server/modules/data/reservations-db");
    notif = await import("@/server/modules/notifications/store");
    docs = await import("@/server/modules/data/documents");
    analytics = await import("@/server/modules/data/analytics-db");
    activity = await import("@/server/modules/demo-store/table-activity");
    settings = await import("@/server/modules/demo-store/settings");
    staff = await import("@/server/modules/demo-store/staff");
  });

  afterAll(async () => {
    const { db } = await import("@/server/db/client");
    await db.$client.end();
  });

  it("table create/rename/remove is persisted and soft-deleted", async () => {
    const created = await tables.createTableDb(R, `T-${tag}`);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const dup = await tables.createTableDb(R, `t-${tag}`);
    expect(dup).toEqual({ ok: false, reason: "duplicate-label" });

    const renamed = await tables.renameTableDb(R, created.table.id, `Patio-${tag}`);
    expect(renamed.ok).toBe(true);
    expect((await tables.getTableByIdDb(R, created.table.id))?.label).toBe(`Patio-${tag}`);

    const removed = await tables.removeTableDb(R, created.table.id);
    expect(removed.ok).toBe(true);
    expect(await tables.getTableByIdDb(R, created.table.id)).toBeNull();
    const list = await tables.getTablesDb(R);
    expect(list.find((t) => t.id === created.table.id)).toBeUndefined();
  });

  it("menu item create/update/availability/delete persists", async () => {
    const code = `Z${tag}`.slice(0, 8).toUpperCase();
    const data = {
      code, name: `Test dish ${tag}`, description: "d", category: "Starters",
      priceRupees: 123, veg: true, available: true, prepMinutes: 7,
      isSpecial: false, discountPercent: 0,
    };
    const created = await menu.createMenuItemDb(R, data);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await menu.createMenuItemDb(R, data)).ok).toBe(false);

    await menu.updateMenuItemDb(R, created.item.id, { ...data, priceRupees: 150 });
    expect((await menu.getMenuItemByIdDb(R, created.item.id))?.priceRupees).toBe(150);

    await menu.setItemAvailabilityDb(R, code, false);
    expect((await menu.getMenuItemByIdDb(R, created.item.id))?.available).toBe(false);

    await menu.setMenuItemImageDb(R, created.item.id, "image/png", new Uint8Array([1, 2, 3]));
    const img = await menu.getMenuImageDb(R, created.item.id);
    expect(Array.from(img!.bytes)).toEqual([1, 2, 3]);

    const del = await menu.deleteMenuItemDb(R, created.item.id);
    expect(del).toMatchObject({ ok: true, mode: "deleted" });
  });

  it("full flow: order -> kitchen -> served -> bill -> payment -> table available", async () => {
    const t = await tables.createTableDb(R, `Flow-${tag}`);
    if (!t.ok) throw new Error("table");
    const tableId = t.table.id;

    const items = (await menu.getMenuDb(R)).filter((m) => m.available).slice(0, 2);
    expect(items.length).toBe(2);

    const placed = await orders.createOrderInDb({
      restaurantId: R, tableId,
      lines: [{ code: items[0].code, qty: 2 }, { code: items[1].code, qty: 1 }],
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const orderId = placed.orderId;

    // table is occupied and visible to every module reading the DB
    expect((await tables.getTableByIdDb(R, tableId))?.status).toBe("occupied");
    expect((await orders.listActiveOrders(R)).some((o) => o.id === orderId)).toBe(true);

    // stale guard: wrong expected status is rejected
    expect(await orders.transitionOrderInDb(R, orderId, "ready")).toMatchObject({
      ok: false, reason: "status-changed",
    });

    expect(await orders.transitionOrderInDb(R, orderId, "new")).toMatchObject({ ok: true, to: "preparing" });
    expect(await orders.transitionOrderInDb(R, orderId, "preparing")).toMatchObject({ ok: true, to: "ready" });

    // cannot bill before served
    const early = await billing.issueBillDb(R, orderId, { gstPercent: 5, serviceChargePercent: 0, discountRupees: 0 });
    expect(early).toMatchObject({ ok: false, reason: "not-served" });

    expect(await orders.transitionOrderInDb(R, orderId, "ready")).toMatchObject({ ok: true, to: "served" });

    const bill = await billing.issueBillDb(R, orderId, { gstPercent: 5, serviceChargePercent: 0, discountRupees: 0 });
    expect(bill.ok).toBe(true);
    if (!bill.ok) return;
    expect((await orders.getOrderFromDb(R, orderId))?.status).toBe("billed");
    // idempotent: second bill is refused
    expect(await billing.issueBillDb(R, orderId, { gstPercent: 5, serviceChargePercent: 0, discountRupees: 0 }))
      .toMatchObject({ ok: false, reason: "already-billed" });

    // table is still busy until the bill is paid
    expect((await tables.getTableByIdDb(R, tableId))?.status).toBe("occupied");
    expect((await tables.removeTableDb(R, tableId)).ok).toBe(false);

    const total = bill.bill.totalRupees;

    // UPI/other methods are rejected: Cash and QR only
    expect(await billing.recordBillPaymentDb(R, bill.bill.id, { method: "upi", amountRupees: total, transactionId: "" }))
      .toMatchObject({ ok: false, reason: "invalid-method" });

    // QR requires a valid, unique reference
    expect(await billing.recordBillPaymentDb(R, bill.bill.id, { method: "qr", amountRupees: total, transactionId: "" }))
      .toMatchObject({ ok: false, reason: "missing-reference" });
    expect(await billing.recordBillPaymentDb(R, bill.bill.id, { method: "qr", amountRupees: total, transactionId: "ab" }))
      .toMatchObject({ ok: false, reason: "invalid-reference" });

    // part payment by cash, then the rest by QR
    const part = await billing.recordBillPaymentDb(R, bill.bill.id, { method: "cash", amountRupees: 1, transactionId: "" });
    expect(part.ok).toBe(true);
    expect((await tables.getTableByIdDb(R, tableId))?.status).toBe("occupied");
    const summaryMid = await billing.getBillPaymentSummaryDb(R, bill.bill.id);
    expect(summaryMid?.paidRupees).toBe(1);

    const ref = `QR${tag}${Math.floor(Math.random() * 1e6)}`;
    const rest = await billing.recordBillPaymentDb(R, bill.bill.id, { method: "qr", amountRupees: total - 1, transactionId: ref });
    expect(rest.ok).toBe(true);
    // same reference cannot be reused
    const reuse = await billing.recordBillPaymentDb(R, bill.bill.id, { method: "qr", amountRupees: 1, transactionId: ref });
    expect(reuse.ok).toBe(false);

    const paid = await billing.getBillDb(R, bill.bill.id);
    expect(paid?.paidAt).not.toBeNull();
    expect((await billing.getBillPaymentSummaryDb(R, bill.bill.id))?.remainingRupees).toBe(0);

    // table released only after full settlement
    expect((await tables.getTableByIdDb(R, tableId))?.status).toBe("available");

    // cross-module consistency
    const payments = await billing.listPaymentsDb(R);
    expect(payments.filter((p) => p.billId === bill.bill.id).length).toBe(2);
    const overview = await analytics.getTodayOverviewDb(R);
    expect(overview.ordersToday).toBeGreaterThan(0);
    expect(overview.salesTodayRupees).toBeGreaterThanOrEqual(total);
    const act = await activity.getTableActivities(R);
    expect(act.find((a) => a.table.id === tableId)).toBeDefined();
    const collection = await billing.getDailyCollectionDb(R);
    expect(collection.byMethod.cash ?? 0).toBeGreaterThanOrEqual(1);

    // now removable (history stays)
    expect((await tables.removeTableDb(R, tableId)).ok).toBe(true);
    expect((await billing.getBillDb(R, bill.bill.id))?.id).toBe(bill.bill.id);
  });

  it("reservations persist and block overlaps", async () => {
    const t = await tables.createTableDb(R, `Res-${tag}`);
    if (!t.ok) throw new Error("table");
    const when = Date.now() + 3 * 3600_000;
    const a = await resv.createReservationDb(R, { tableId: t.table.id, guestName: "A", phone: "9876543210", partySize: 2, reservedFor: when });
    expect(a.ok).toBe(true);
    const b = await resv.createReservationDb(R, { tableId: t.table.id, guestName: "B", phone: "9876543211", partySize: 2, reservedFor: when + 30 * 60_000 });
    expect(b).toEqual({ ok: false, reason: "overlap" });
    if (a.ok) {
      const upd = await resv.setReservationStatusDb(R, a.reservation.id, "cancelled");
      expect(upd?.status).toBe("cancelled");
      expect((await resv.getReservationDb(R, a.reservation.id))?.status).toBe("cancelled");
    }
    await tables.removeTableDb(R, t.table.id);
  });

  it("notifications, documents, settings, staff persist across calls", async () => {
    const n = await notif.notify({ type: "ORDER_NEW", title: `n-${tag}`, message: "m", dedupeKey: `k-${tag}` });
    const again = await notif.notify({ type: "ORDER_NEW", title: `n2-${tag}`, message: "m", dedupeKey: `k-${tag}` });
    expect(again.id).toBe(n.id); // deduped
    expect((await notif.listFor("owner")).some((x) => x.id === n.id)).toBe(true);
    expect(await notif.resolveByKey(`k-${tag}`)).toBe(true);

    await docs.putDoc(R, "test_collection", tag, { v: 1 });
    expect(await docs.getDoc(R, "test_collection", tag)).toEqual({ v: 1 });
    await docs.deleteDoc(R, "test_collection", tag);

    const s0 = await settings.getSettings(`rest-${tag}`);
    await settings.saveSettings(`rest-${tag}`, { ...s0, name: `Cafe ${tag}`, payment: { cash: true, qr: true } });
    expect((await settings.getSettings(`rest-${tag}`)).name).toBe(`Cafe ${tag}`);

    const m = await staff.createStaff(`rest-${tag}`, { name: "X", contact: `x${tag}@t.dev`, role: "waiter", status: "active", joinedOn: null });
    expect((await staff.listStaff(`rest-${tag}`)).map((x) => x.id)).toContain(m.id);
    expect(await staff.isContactTaken(`rest-${tag}`, `X${tag}@t.dev`)).toBe(true);
  });
});
