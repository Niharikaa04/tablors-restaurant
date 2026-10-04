import { describe, it, expect } from "vitest";
import { LoyaltyLedger, calcPoints, InsufficientPointsError, LoyaltyPermissionError, type LoyaltyRule, type BillBreakdown } from "../loyalty";
import { PotsService } from "../pots-service";
import { processPaymentEvent } from "../payment-pipeline";
import { readFileSync } from "node:fs";
import { rupees as R } from "../money";

// Test-only rule values (NOT product defaults).
const rule = (o: Partial<LoyaltyRule> = {}): LoyaltyRule => ({
  businessId: "b1", version: 1, enabled: true, pointsPerBlock: 1, blockPaise: R(10), deductDiscounts: true,
  excludeGst: true, excludeServiceCharge: true, excludeDelivery: true, excludeTips: true,
  excludedCategories: [], excludedItemIds: [], campaigns: [], refundPolicy: "PROPORTIONAL", ...o,
});
const bill: BillBreakdown = { items: [{ id: "i1", category: "food", amountPaise: R(900) }], gstPaise: R(100), serviceChargePaise: 0, deliveryPaise: 0, tipPaise: 0, discountPaise: 0, totalPaise: R(1000) };
const at = new Date("2026-10-05T10:00:00Z");

describe("loyalty earning policy", () => {
  it("addendum example: 900 eligible @1/10 = 90; configurable exclusions/min/max/campaign", () => {
    expect(calcPoints(rule(), bill, at)).toEqual({ eligible: R(900), points: 90 });
    expect(calcPoints(rule({ excludeGst: false }), bill, at).points).toBe(100);
    expect(calcPoints(rule({ excludedCategories: ["food"] }), bill, at).points).toBe(0);
    expect(calcPoints(rule({ minBillPaise: R(2000) }), bill, at).points).toBe(0);
    expect(calcPoints(rule({ maxPointsPerBill: 50 }), bill, at).points).toBe(50);
    expect(calcPoints(rule({ campaigns: [{ multiplierPercent: 200, from: new Date("2026-10-01"), to: new Date("2026-10-31") }] }), bill, at).points).toBe(180);
    expect(calcPoints(rule({ enabled: false }), bill, at).points).toBe(0);
  });
});

describe("loyalty ledger", () => {
  const earn = (L: LoyaltyLedger, status: "SUCCESS" | "FAILED" | "PENDING" = "SUCCESS", billId = "bill1") =>
    L.earn({ rule: rule({ expiryDays: 30 }), customerId: "c1", billId, paymentId: "pay_" + billId, paymentStatus: status, bill, at });
  it("earns exactly once; not on failed/pending", () => {
    const L = new LoyaltyLedger(() => at);
    expect(earn(L, "FAILED").status).toBe("NOT_ELIGIBLE"); expect(earn(L, "PENDING").status).toBe("NOT_ELIGIBLE");
    expect(earn(L).status).toBe("EARNED"); expect(earn(L).status).toBe("DUPLICATE");
    expect(L.balance("b1", "c1")).toBe(90);
  });
  it("redemption: hold, commit deducts once; cancel releases; never negative", () => {
    const L = new LoyaltyLedger(() => at); earn(L);
    L.requestRedemption({ redemptionId: "r1", businessId: "b1", customerId: "c1", points: 50, billId: "x" });
    expect(L.balance("b1", "c1")).toBe(90); expect(L.available("b1", "c1")).toBe(40);
    expect(() => L.requestRedemption({ redemptionId: "r2", businessId: "b1", customerId: "c1", points: 50, billId: "y" })).toThrow(InsufficientPointsError);
    L.commitRedemption("r1", "pay"); L.commitRedemption("r1", "pay");
    expect(L.balance("b1", "c1")).toBe(40);
    L.requestRedemption({ redemptionId: "r3", businessId: "b1", customerId: "c1", points: 40, billId: "z" });
    L.cancelRedemption("r3"); expect(L.available("b1", "c1")).toBe(40);
  });
  it("manual adjustment needs reason + permission; cannot go negative", () => {
    const L = new LoyaltyLedger(() => at); earn(L);
    const base = { businessId: "b1", customerId: "c1", adjustmentId: "a1", actorId: "u" };
    expect(() => L.adjust({ ...base, points: 5, reason: "", role: "OWNER" })).toThrow();
    expect(() => L.adjust({ ...base, points: 5, reason: "gift", role: "STAFF" })).toThrow(LoyaltyPermissionError);
    expect(() => L.adjust({ ...base, points: -500, reason: "fix", role: "OWNER" })).toThrow(InsufficientPointsError);
    L.adjust({ ...base, points: -10, reason: "fix", role: "OWNER" }); expect(L.balance("b1", "c1")).toBe(80);
  });
  it("refund creates reversal entries (original untouched), proportional, capped by balance", () => {
    const L = new LoyaltyLedger(() => at); earn(L);
    const orig = L.ledger("b1", "c1")[0];
    const r = L.refundReversal({ businessId: "b1", customerId: "c1", billId: "bill1", refundId: "rf1", refundedPaise: R(500), billPaise: R(1000), policy: "PROPORTIONAL" });
    expect(r).toMatchObject({ status: "REVERSED", reversed: 45 }); expect(L.ledger("b1", "c1")[0]).toBe(orig);
    expect(L.refundReversal({ businessId: "b1", customerId: "c1", billId: "bill1", refundId: "rf1", refundedPaise: R(500), billPaise: R(1000), policy: "PROPORTIONAL" }).status).toBe("DUPLICATE");
    L.refundReversal({ businessId: "b1", customerId: "c1", billId: "bill1", refundId: "rf2", refundedPaise: R(1000), billPaise: R(1000), policy: "PROPORTIONAL" });
    expect(L.balance("b1", "c1")).toBe(0);
  });
  it("refund after customer spent points never drives balance negative", () => {
    const L = new LoyaltyLedger(() => at); earn(L);
    L.requestRedemption({ redemptionId: "r", businessId: "b1", customerId: "c1", points: 80, billId: "x" }); L.commitRedemption("r", "p");
    const r = L.refundReversal({ businessId: "b1", customerId: "c1", billId: "bill1", refundId: "rf", refundedPaise: R(1000), billPaise: R(1000), policy: "FULL_ONLY" });
    expect(L.balance("b1", "c1")).toBe(0); expect(r).toMatchObject({ reversed: 10, unrecovered: 80 });
  });
  it("expiry writes EXPIRE entries and only for unconsumed points", () => {
    const L = new LoyaltyLedger(() => at); earn(L);
    L.requestRedemption({ redemptionId: "r", businessId: "b1", customerId: "c1", points: 30, billId: "x" }); L.commitRedemption("r", "p");
    expect(L.expire("b1", "c1", new Date("2026-12-01"))).toBe(60);
    expect(L.balance("b1", "c1")).toBe(0); expect(L.ledger("b1", "c1").some((t) => t.type === "EXPIRE")).toBe(true);
    expect(L.expire("b1", "c1", new Date("2026-12-01"))).toBe(0);
  });
});

describe("loyalty is separate from money", () => {
  it("one payment drives both ledgers; points never touch pots/reconciliation; replay is idempotent on both", () => {
    const pots = new PotsService(); pots.createDefaultPots("b1");
    const loyalty = new LoyaltyLedger();
    const ev = { businessId: "b1", eventId: "e1", paymentId: "P", billId: "bill1", status: "SUCCESS" as const, amount: R(1000) };
    const a = processPaymentEvent({ pots, loyalty, loyaltyRule: rule() }, ev, { customerId: "c1", bill });
    const snapshot = JSON.stringify(pots.reconcile("b1"));
    const b = processPaymentEvent({ pots, loyalty, loyaltyRule: rule() }, { ...ev, eventId: "e2" }, { customerId: "c1", bill });
    expect(a.points?.status).toBe("EARNED"); expect(b.points?.status).toBe("DUPLICATE"); expect(b.money.outcome).toBe("ALREADY_ALLOCATED");
    loyalty.adjust({ businessId: "b1", customerId: "c1", adjustmentId: "g", points: 1000, reason: "promo", actorId: "o", role: "OWNER" });
    expect(JSON.stringify(pots.reconcile("b1"))).toBe(snapshot);
    expect(pots.getUnallocated("b1")).toBe(R(1000)); // no rules configured -> all unallocated, none invented
  });
  it("loyalty module has no dependency on the pots ledger", () => {
    const src = readFileSync(new URL("../loyalty.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["']\.\/pots-service["']/);
  });
});
