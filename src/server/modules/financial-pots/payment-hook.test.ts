import { beforeEach, describe, expect, it, vi } from "vitest";
import { onBillPaymentConfirmed, onPaymentRefunded, rupeesToPaise } from "./payment-hook";
import { DEMO_BUSINESS_ID, getPotsRuntime, resetPotsRuntimeForTests } from "@/server/modules/pots/runtime";

// Mock the real store so this test does not depend on its internals.
const store = vi.hoisted(() => ({ payments: [] as unknown[] }));
vi.mock("@/server/modules/demo-store/store", () => ({ getPayments: () => store.payments }));

const B = DEMO_BUSINESS_ID;
const potId = (t: string) => `${B}:${t}`;
const T = new Date("2026-10-03T10:00:00Z");

describe("payment hook -> pots ledger (sandbox)", () => {
  beforeEach(() => {
    resetPotsRuntimeForTests();
    store.payments.length = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("converts rupees to paise without float drift and rejects bad amounts", () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(rupeesToPaise(0.29)).toBe(29);
    expect(rupeesToPaise(1180.1)).toBe(118010);
    expect(() => rupeesToPaise(0)).toThrow();
    expect(() => rupeesToPaise(NaN)).toThrow();
  });

  it("no rules configured: money lands in UNALLOCATED, ledger reconciles, nothing invented", () => {
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 100 });
    onBillPaymentConfirmed("b1", "cash");
    const rt = getPotsRuntime();
    expect(rt.ledger.unallocated(B)).toBe(10000);
    expect(rt.ledger.merchantFunds(B)).toBe(10000);
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
    expect(rt.potIds.every((id) => rt.ledger.potBalance(B, id) === 0)).toBe(true);
  });

  it("calling the hook twice (retry/double click) allocates once", () => {
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 100 });
    onBillPaymentConfirmed("b1", "cash");
    onBillPaymentConfirmed("b1", "cash");
    expect(getPotsRuntime().ledger.merchantFunds(B)).toBe(10000);
  });

  it("split payments: each store payment is its own ledger payment; other bills are ignored", () => {
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 40 }, { id: "p2", billId: "b1", amountRupees: 60 }, { id: "p9", billId: "other", amountRupees: 500 });
    onBillPaymentConfirmed("b1", "upi");
    const rt = getPotsRuntime();
    expect(rt.ledger.merchantFunds(B)).toBe(10000);
    expect(rt.payments.getPayment("p1")?.status).toBe("SUCCESS");
    expect(rt.payments.getPayment("p9")).toBeUndefined();
  });

  it("with an owner-published rule, allocation follows the rule and keeps its version", () => {
    const rt = getPotsRuntime();
    rt.registry.publish(B, { ruleKey: "inv", potId: potId("INVENTORY"), method: "PERCENTAGE", value: 2000, priority: 1, effectiveFrom: new Date("2020-01-01") },
      { id: "owner", role: "OWNER" }, { stepUpVerified: true, reason: "test rule", at: T });
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 100 });
    onBillPaymentConfirmed("b1", "cash");
    expect(rt.ledger.potBalance(B, potId("INVENTORY"))).toBe(2000);
    expect(rt.ledger.unallocated(B)).toBe(8000);
    expect(rt.payments.getPayment("p1")?.allocation?.lines[0]?.ruleVersion).toBe(1);
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
  });

  it("refund creates reversal rows and reduces funds; replay is a no-op", () => {
    const rt = getPotsRuntime();
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 100 });
    onBillPaymentConfirmed("b1", "cash");
    const before = rt.ledger.entries(B).length;
    onPaymentRefunded({ refundId: "r1", paymentId: "p1", amountRupees: 30, reason: "complaint" });
    expect(rt.ledger.merchantFunds(B)).toBe(7000);
    expect(rt.ledger.entries(B).length).toBeGreaterThan(before); // appended, not edited
    onPaymentRefunded({ refundId: "r1", paymentId: "p1", amountRupees: 30, reason: "complaint" });
    expect(rt.ledger.merchantFunds(B)).toBe(7000);
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
  });

  it("never throws into billing: unknown payment, malformed store row, oversized refund", () => {
    expect(() => onPaymentRefunded({ refundId: "x", paymentId: "ghost", amountRupees: 10, reason: "r" })).not.toThrow();
    store.payments.push({ id: 5, billId: "b1" });
    expect(() => onBillPaymentConfirmed("b1", "cash")).not.toThrow();
  });
});
