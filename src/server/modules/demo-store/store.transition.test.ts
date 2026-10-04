import { describe, expect, it } from "vitest";

import {
  advanceOrderStatus,
  createDemoOrder,
  generateBill,
  getOrder,
  getTableById,
  transitionOrder,
} from "./store";

function freshOrder() {
  return createDemoOrder("t01", [
    { code: "125", name: "Butter Naan", qty: 1, priceRupees: 45 },
  ]);
}

describe("transitionOrder", () => {
  it("walks new → preparing → ready → served", () => {
    const order = freshOrder();

    expect(transitionOrder(order.id)).toMatchObject({
      ok: true,
      from: "new",
      to: "preparing",
    });
    expect(transitionOrder(order.id)).toMatchObject({
      ok: true,
      from: "preparing",
      to: "ready",
    });
    expect(transitionOrder(order.id)).toMatchObject({
      ok: true,
      from: "ready",
      to: "served",
    });
  });

  it("never advances served → billed", () => {
    const order = freshOrder();
    transitionOrder(order.id);
    transitionOrder(order.id);
    transitionOrder(order.id);

    expect(transitionOrder(order.id)).toMatchObject({
      ok: false,
      reason: "already-served",
    });
    expect(advanceOrderStatus(order.id)?.status).toBe("served");
  });

  it("rejects a stale expected status without changing the order", () => {
    const order = freshOrder();

    expect(transitionOrder(order.id, "ready")).toMatchObject({
      ok: false,
      reason: "status-changed",
    });
    expect(getOrder(order.id)?.status).toBe("new");
  });

  it("returns not-found for an unknown order", () => {
    expect(transitionOrder("does-not-exist")).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("refuses to advance a billed order", () => {
    const order = freshOrder();
    generateBill(order.id, {
      gstPercent: 0,
      discountRupees: 0,
      serviceChargePercent: 0,
    });

    expect(transitionOrder(order.id)).toMatchObject({
      ok: false,
      reason: "already-billed",
    });
  });

  it("keeps the table occupied and linked while an order is served", () => {
    const order = freshOrder();
    transitionOrder(order.id);
    transitionOrder(order.id);
    transitionOrder(order.id);

    const table = getTableById("t01");
    expect(table?.status).toBe("occupied");
    expect(table?.currentOrderId).toBe(order.id);
  });

  it("exposes one canonical order to every reader", () => {
    const order = freshOrder();
    transitionOrder(order.id);

    expect(getOrder(order.id)?.status).toBe("preparing");
    expect(getOrder(order.id)).toBe(order);
  });
});