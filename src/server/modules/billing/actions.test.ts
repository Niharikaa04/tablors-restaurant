import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  role: null as string | null,
}));

const nav = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

const hook = vi.hoisted(() => ({
  onPaid: vi.fn(),
}));

vi.mock("@/server/modules/auth/session", () => ({
  getDemoRole: async () => session.role,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: nav.redirect,
}));

vi.mock("@/server/modules/financial-pots/payment-hook", () => ({
  onBillPaymentConfirmed: hook.onPaid,
}));

import {
  createDemoOrder,
  createRestaurantTable,
  getBills,
  getOrder,
  transitionOrder,
} from "@/server/modules/demo-store/store";

import { createBill } from "./actions";

let tableCounter = 0;

function newTableId(): string {
  tableCounter += 1;

  const created = createRestaurantTable(
    `Billing Action Test ${tableCounter}`
  );

  if (!created.ok) {
    throw new Error("Could not create test table");
  }

  return created.table.id;
}

function orderIn(tableId: string) {
  return createDemoOrder(tableId, [
    {
      code: "125",
      name: "Butter Naan",
      qty: 2,
      priceRupees: 50,
    },
  ]);
}

function servedOrder() {
  const order = orderIn(newTableId());

  transitionOrder(order.id);
  transitionOrder(order.id);
  transitionOrder(order.id);

  return order;
}

function form(values: {
  gst?: string;
  service?: string;
  discount?: string;
}) {
  const data = new FormData();

  data.set("gstPercent", values.gst ?? "5");
  data.set("serviceChargePercent", values.service ?? "0");
  data.set("discountRupees", values.discount ?? "0");

  return data;
}

function lastRedirect(): string {
  const calls = nav.redirect.mock.calls;

  return String(calls[calls.length - 1]?.[0] ?? "");
}

function billOf(orderId: string) {
  return getBills().find((b) => b.orderId === orderId);
}

describe("billing actions", () => {
  beforeEach(() => {
    session.role = "owner";
    nav.redirect.mockClear();
    hook.onPaid.mockClear();
  });

  it("rejects createBill for signed-out and kitchen callers", async () => {
    for (const role of [null, "kitchen"]) {
      session.role = role;

      const order = servedOrder();

      await createBill(order.id, form({}));

      expect(lastRedirect()).toContain("notice=forbidden");
      expect(billOf(order.id)).toBeUndefined();
      expect(getOrder(order.id)?.status).toBe("served");
    }
  });

  it("rejects an unserved order", async () => {
    const order = orderIn(newTableId());

    await createBill(order.id, form({}));

    expect(lastRedirect()).toContain("notice=not-served");
    expect(billOf(order.id)).toBeUndefined();
  });

  it("creates a bill for a served order", async () => {
    const order = servedOrder();

    await createBill(
      order.id,
      form({
        gst: "5",
        service: "10",
        discount: "20",
      })
    );

    expect(lastRedirect()).toContain("notice=billed");
    expect(billOf(order.id)?.totalRupees).toBe(95);
  });

  it("rejects forged discount, GST and service values", async () => {
    const order = servedOrder();

    await createBill(
      order.id,
      form({
        discount: "-5",
      })
    );

    expect(lastRedirect()).toContain("notice=invalid-discount");

    await createBill(
      order.id,
      form({
        gst: "abc",
      })
    );

    expect(lastRedirect()).toContain("notice=invalid-gst");

    await createBill(
      order.id,
      form({
        service: "99",
      })
    );

    expect(lastRedirect()).toContain("notice=invalid-service-charge");

    expect(billOf(order.id)).toBeUndefined();
  });

  it("does not create a duplicate bill", async () => {
    const order = servedOrder();

    await createBill(order.id, form({}));
    await createBill(order.id, form({}));

    expect(lastRedirect()).toContain("notice=duplicate");
    expect(
      getBills().filter((b) => b.orderId === order.id)
    ).toHaveLength(1);
  });
});