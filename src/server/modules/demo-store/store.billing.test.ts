import { describe, expect, it } from "vitest";

import {
  createDemoOrder,
  createRestaurantTable,
  getBills,
  getOrder,
  getTableById,
  issueBill,
  transitionOrder,
} from "./store";

let tableCounter = 0;

/** Every test gets its own table so state never leaks between tests. */
function newTable(): string {
  tableCounter += 1;
  const created = createRestaurantTable(`Billing Test ${tableCounter}`);

  if (!created.ok) {
    throw new Error("Could not create test table");
  }

  return created.table.id;
}

function orderIn(tableId: string) {
  // 2 × ₹50 = ₹100 subtotal.
  return createDemoOrder(tableId, [
    { code: "125", name: "Butter Naan", qty: 2, priceRupees: 50 },
  ]);
}

function servedOrder(tableId: string) {
  const order = orderIn(tableId);
  transitionOrder(order.id);
  transitionOrder(order.id);
  transitionOrder(order.id);
  return order;
}

const plain = {
  gstPercent: 0,
  serviceChargePercent: 0,
  discountRupees: 0,
};

describe("issueBill", () => {
  it("rejects new, preparing and ready orders", () => {
    const order = orderIn(newTable());

    expect(issueBill(order.id, plain)).toMatchObject({
      ok: false,
      reason: "not-served",
      status: "new",
    });

    transitionOrder(order.id);

    expect(issueBill(order.id, plain)).toMatchObject({
      ok: false,
      reason: "not-served",
      status: "preparing",
    });

    transitionOrder(order.id);

    expect(issueBill(order.id, plain)).toMatchObject({
      ok: false,
      reason: "not-served",
      status: "ready",
    });

    expect(getOrder(order.id)?.status).toBe("ready");
    expect(getBills().some((b) => b.orderId === order.id)).toBe(false);
  });

  it("returns not-found for an unknown order", () => {
    expect(issueBill("does-not-exist", plain)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("bills a served order, marks it billed and keeps the table occupied", () => {
    const tableId = newTable();
    const order = servedOrder(tableId);

    const result = issueBill(order.id, plain);

    expect(result.ok).toBe(true);
    expect(getOrder(order.id)?.status).toBe("billed");
    expect(getTableById(tableId)?.status).toBe("occupied");
  });

  it("calculates GST, service charge, discount and total on the server", () => {
    const order = servedOrder(newTable());

    const result = issueBill(order.id, {
      gstPercent: 5,
      serviceChargePercent: 10,
      discountRupees: 20,
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.bill.subtotalRupees).toBe(100);
      expect(result.bill.gstRupees).toBe(5);
      expect(result.bill.serviceChargeRupees).toBe(10);
      expect(result.bill.discountRupees).toBe(20);
      expect(result.bill.totalRupees).toBe(95);
      expect(result.bill.paymentMethod).toBeNull();
      expect(result.bill.paidAt).toBeNull();
    }
  });

  it("rejects a second bill for the same order and returns the existing one", () => {
    const order = servedOrder(newTable());

    const first = issueBill(order.id, plain);
    const second = issueBill(order.id, plain);

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({
      ok: false,
      reason: "already-billed",
    });

    if (first.ok && !second.ok && second.reason === "already-billed") {
      expect(second.bill.id).toBe(first.bill.id);
    }

    expect(
      getBills().filter((b) => b.orderId === order.id)
    ).toHaveLength(1);
  });

  it("rejects invalid inputs without creating a bill or changing the order", () => {
    const order = servedOrder(newTable());

    expect(
      issueBill(order.id, {
        ...plain,
        discountRupees: -5,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-discount",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        discountRupees: 2.5,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-discount",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        discountRupees: Number.NaN,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-discount",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        discountRupees: 500,
      })
    ).toMatchObject({
      ok: false,
      reason: "discount-too-large",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        gstPercent: -1,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-gst",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        gstPercent: 29,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-gst",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        gstPercent: Number.NaN,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-gst",
    });

    expect(
      issueBill(order.id, {
        ...plain,
        serviceChargePercent: 21,
      })
    ).toMatchObject({
      ok: false,
      reason: "invalid-service-charge",
    });

    expect(getOrder(order.id)?.status).toBe("served");
    expect(getBills().some((b) => b.orderId === order.id)).toBe(false);
  });

  it("allows a discount equal to the full amount (total 0) but never negative", () => {
    const order = servedOrder(newTable());

    const result = issueBill(order.id, {
      ...plain,
      discountRupees: 100,
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.bill.totalRupees).toBe(0);
    }
  });
});