import { describe, expect, it } from "vitest";

import type { Bill, Order, Payment, Refund, RestaurantTable } from "@/server/modules/demo-store/store";
import {
  CANCELLED_ORDERS_SUPPORTED,
  buildSalesReport,
  getPeriodRange,
  parseReportPeriod,
  type ReportData,
} from "./reports";

const IST = 330 * 60 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const ist = (y: number, m: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h, min) - IST;

// Wednesday 2026-09-16, 3:00 PM IST
const NOW = ist(2026, 9, 16, 15);

const tables: RestaurantTable[] = ["t01", "t02"].map((id, i) => ({
  id,
  label: `Table 0${i + 1}`,
  status: "available",
  currentOrderId: null,
  waiterCalled: false,
  waiterCalledAt: null,
}));

function order(
  id: string,
  tableId: string,
  createdAt: number,
  lines: { name: string; category: string; qty: number; price: number; itemId: string }[],
  status: Order["status"] = "served"
): Order {
  return {
    id,
    tableId,
    status,
    createdAt,
    statusUpdatedAt: createdAt,
    lines: lines.map((l) => ({
      code: l.itemId,
      name: l.name,
      qty: l.qty,
      priceRupees: l.price,
      itemId: l.itemId,
      category: l.category,
    })),
  };
}

const biryani = { name: "Biryani", category: "Biryanis & Rice", price: 300, itemId: "m1" };
const naan = { name: "Naan", category: "Breads", price: 50, itemId: "m2" };

const orders: Order[] = [
  order("o1", "t01", ist(2026, 9, 16, 13, 10), [{ ...biryani, qty: 2 }, { ...naan, qty: 4 }], "billed"), // 800
  order("o2", "t02", ist(2026, 9, 16, 13, 40), [{ ...biryani, qty: 1 }]), // 300
  order("o3", "t01", ist(2026, 9, 15, 20, 0), [{ ...naan, qty: 2 }], "billed"), // 100, yesterday
  order("o4", "t02", ist(2026, 9, 14, 12, 0), [{ ...biryani, qty: 1 }]), // Monday, this week
  order("o5", "t02", ist(2026, 9, 10, 12, 0), [{ ...naan, qty: 1 }]), // last week, this month
  order("o6", "t01", ist(2026, 8, 31, 23, 30), [{ ...naan, qty: 1 }]), // last month
];

const bill = (id: string, orderId: string, tableId: string, total: number, paidAt: number | null): Bill => ({
  id,
  orderId,
  tableId,
  subtotalRupees: total,
  gstRupees: 0,
  discountRupees: 0,
  serviceChargeRupees: 0,
  totalRupees: total,
  paymentMethod: paidAt ? "cash" : null,
  paidAt,
});

const bills: Bill[] = [
  bill("b1", "o1", "t01", 840, ist(2026, 9, 16, 14, 10)), // 800 + 5% GST, paid 60 min after order
  bill("b3", "o3", "t01", 105, ist(2026, 9, 15, 21, 0)),
];

const pay = (id: string, billId: string, method: Payment["method"], amt: number, paidAt: number): Payment => ({
  id,
  billId,
  orderId: "x",
  tableId: "t01",
  method,
  amountRupees: amt,
  transactionId: null,
  paidAt,
});

const payments: Payment[] = [
  pay("p1", "b1", "cash", 340, ist(2026, 9, 16, 14, 10)),
  pay("p2", "b1", "upi", 500, ist(2026, 9, 16, 14, 10)),
  pay("p3", "b3", "cash", 105, ist(2026, 9, 15, 21, 0)),
];

const refunds: Refund[] = [
  { id: "r1", paymentId: "p2", billId: "b1", amountRupees: 40, reason: "test", status: "completed", refundedAt: ist(2026, 9, 16, 14, 30) },
];

const data: ReportData = { orders, bills, payments, refunds, tables };

describe("period handling", () => {
  it("parses and defaults the period", () => {
    expect(parseReportPeriod("week")).toBe("week");
    expect(parseReportPeriod("bogus")).toBe("today");
    expect(parseReportPeriod(undefined)).toBe("today");
    expect(parseReportPeriod(["month", "x"])).toBe("month");
  });

  it("computes IST boundaries", () => {
    expect(getPeriodRange("today", NOW)).toEqual({ start: ist(2026, 9, 16), end: ist(2026, 9, 17) });
    expect(getPeriodRange("yesterday", NOW)).toEqual({ start: ist(2026, 9, 15), end: ist(2026, 9, 16) });
    expect(getPeriodRange("week", NOW)).toEqual({ start: ist(2026, 9, 14), end: ist(2026, 9, 21) });
    expect(getPeriodRange("month", NOW)).toEqual({ start: ist(2026, 9, 1), end: ist(2026, 10, 1) });
  });

  it("puts 11:30 PM IST on the correct day even though it is a different UTC day", () => {
    expect(getPeriodRange("today", ist(2026, 9, 1, 23, 30)).start).toBe(ist(2026, 9, 1));
  });
});

describe("sales overview", () => {
  it("today", () => {
    const o = buildSalesReport(data, "today", NOW).overview;
    expect(o.orderCount).toBe(2);
    expect(o.orderValueRupees).toBe(1100);
    expect(o.averageOrderValueRupees).toBe(550);
    expect(o.totalSalesRupees).toBe(840);
    expect(o.billedOrders).toBe(1);
  });

  it("yesterday", () => {
    const o = buildSalesReport(data, "yesterday", NOW).overview;
    expect(o.orderCount).toBe(1);
    expect(o.totalSalesRupees).toBe(105);
    expect(o.averageOrderValueRupees).toBe(100);
  });

  it("week and month filtering", () => {
    expect(buildSalesReport(data, "week", NOW).overview.orderCount).toBe(4);
    expect(buildSalesReport(data, "month", NOW).overview.orderCount).toBe(5);
  });

  it("returns zeros for an empty period", () => {
    const o = buildSalesReport({ ...data, orders: [], bills: [], payments: [], refunds: [] }, "today", NOW).overview;
    expect(o.orderCount).toBe(0);
    expect(o.averageOrderValueRupees).toBe(0);
    expect(o.totalSalesRupees).toBe(0);
  });

  it("payment totals by method, net of refunds", () => {
    const o = buildSalesReport(data, "today", NOW).overview;
    expect(o.collectedByMethod).toEqual({ cash: 340, upi: 500, card: 0 });
    expect(o.collectedRupees).toBe(840);
    expect(o.refundedRupees).toBe(40);
    expect(o.netCollectedRupees).toBe(800);
  });
});

describe("breakdowns", () => {
  it("popular items ranked by qty", () => {
    const items = buildSalesReport(data, "month", NOW).popularItems;
    expect(items[0]).toMatchObject({ name: "Naan", qtySold: 7, revenueRupees: 350 });
    expect(items[1]).toMatchObject({ name: "Biryani", qtySold: 4, revenueRupees: 1200 });
  });

  it("category sales with share", () => {
    const cats = buildSalesReport(data, "today", NOW).categories;
    expect(cats[0]).toMatchObject({ category: "Biryanis & Rice", orders: 2, qtySold: 3, revenueRupees: 900 });
    expect(cats[1]).toMatchObject({ category: "Breads", orders: 1, revenueRupees: 200 });
    expect(cats[0].sharePercent).toBeCloseTo(81.8, 1);
  });

  it("table sales", () => {
    const t = buildSalesReport(data, "today", NOW).tables;
    expect(t[0]).toMatchObject({ label: "Table 01", orders: 1, revenueRupees: 800, averageOrderValueRupees: 800 });
    expect(t[1]).toMatchObject({ label: "Table 02", orders: 1, revenueRupees: 300 });
  });

  it("peak hour from order timestamps (IST)", () => {
    const r = buildSalesReport(data, "today", NOW);
    expect(r.busiestHour).toMatchObject({ hour: 13, orders: 2 });
  });

  it("no busiest hour when there are no orders", () => {
    expect(buildSalesReport({ ...data, orders: [] }, "today", NOW).busiestHour).toBeNull();
  });
});

describe("table time and cancellations", () => {
  it("averages order-to-payment minutes for settled bills", () => {
    const t = buildSalesReport(data, "today", NOW).tableTime;
    expect(t).toEqual({ available: true, averageMinutes: 60, sampleSize: 1 });
  });

  it("is unavailable when nothing is settled", () => {
    const t = buildSalesReport({ ...data, bills: [] }, "today", NOW).tableTime;
    expect(t.available).toBe(false);
  });

  it("reports cancellations as unsupported instead of inventing a count", () => {
    expect(CANCELLED_ORDERS_SUPPORTED).toBe(false);
    expect(buildSalesReport(data, "today", NOW).cancelled.supported).toBe(false);
  });
});

it("DAY constant sanity", () => {
  expect(getPeriodRange("week", NOW).end - getPeriodRange("week", NOW).start).toBe(7 * DAY);
});