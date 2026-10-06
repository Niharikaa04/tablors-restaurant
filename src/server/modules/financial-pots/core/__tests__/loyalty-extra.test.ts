import { beforeEach, describe, expect, it } from "vitest";
import { LoyaltyLedger, LoyaltyLimitError, LoyaltyPermissionError, type LoyaltyRule, type BillBreakdown } from "../loyalty";
import { RewardCatalog, rewardDiscount } from "../rewards";
import { rupees as R } from "../money";

const B = "biz", C = "cust";
const rule: LoyaltyRule = { businessId: B, version: 1, enabled: true, pointsPerBlock: 1, blockPaise: R(10), deductDiscounts: false, excludeGst: true, excludeServiceCharge: true, excludeDelivery: true, excludeTips: true, excludedCategories: [], excludedItemIds: [], campaigns: [], refundPolicy: "PROPORTIONAL" };
const bill = (food: number): BillBreakdown => ({ items: [{ id: "i", category: "food", amountPaise: R(food) }], gstPaise: 0, serviceChargePaise: 0, deliveryPaise: 0, tipPaise: 0, discountPaise: 0, totalPaise: R(food) });
const T = new Date("2026-10-03T10:00:00Z");
let L: LoyaltyLedger;
const give = (n: number) => L.adjust({ businessId: B, customerId: C, adjustmentId: `g${n}${Math.random()}`, points: n, reason: "seed", actorId: "o", role: "OWNER" });

describe("loyalty gaps closed", () => {
  beforeEach(() => { L = new LoyaltyLedger(() => T); });

  it("adjustments must be non-zero whole numbers", () => {
    expect(() => give(0)).toThrow(); expect(() => give(1.5)).toThrow();
  });
  it("daily and monthly earning caps per customer", () => {
    const r = { ...rule, maxPointsPerDay: 100 };
    expect(L.earn({ rule: r, customerId: C, billId: "b1", paymentId: "p1", paymentStatus: "SUCCESS", bill: bill(700), at: T }).points).toBe(70);
    expect(L.earn({ rule: r, customerId: C, billId: "b2", paymentId: "p2", paymentStatus: "SUCCESS", bill: bill(700), at: T }).points).toBe(30);
    expect(L.earn({ rule: r, customerId: C, billId: "b3", paymentId: "p3", paymentStatus: "SUCCESS", bill: bill(700), at: T }).status).toBe("LIMIT_REACHED");
    const nextDay = new Date(T.getTime() + 86400000);
    expect(L.earn({ rule: r, customerId: C, billId: "b4", paymentId: "p4", paymentStatus: "SUCCESS", bill: bill(700), at: nextDay }).points).toBe(70);
    expect(L.balance(B, C)).toBe(170);
  });
  it("suspended accounts cannot redeem; unsuspend restores access", () => {
    give(100); L.suspend(B, C);
    expect(() => L.requestRedemption({ redemptionId: "r", businessId: B, customerId: C, points: 10, billId: "x" })).toThrow(LoyaltyPermissionError);
    L.unsuspend(B, C);
    expect(L.requestRedemption({ redemptionId: "r", businessId: B, customerId: C, points: 10, billId: "x" }).status).toBe("HELD");
  });
  it("daily redemption limit and minimum points", () => {
    give(500);
    const lim = { maxPointsPerDay: 100, minPoints: 20 };
    expect(() => L.requestRedemption({ redemptionId: "a", businessId: B, customerId: C, points: 10, billId: "x", at: T, limits: lim })).toThrow(LoyaltyLimitError);
    L.requestRedemption({ redemptionId: "b", businessId: B, customerId: C, points: 80, billId: "x", at: T, limits: lim });
    expect(() => L.requestRedemption({ redemptionId: "c", businessId: B, customerId: C, points: 30, billId: "x", at: T, limits: lim })).toThrow(LoyaltyLimitError);
  });
  it("restoring redeemed points after a refund appends a row and never edits the REDEEM", () => {
    give(100);
    L.requestRedemption({ redemptionId: "r", businessId: B, customerId: C, points: 60, billId: "x" });
    L.commitRedemption("r", "pay1");
    expect(L.balance(B, C)).toBe(40);
    expect(L.restoreRedemption({ redemptionId: "r", refundId: "rf1" }).status).toBe("RESTORED");
    expect(L.restoreRedemption({ redemptionId: "r", refundId: "rf1" }).status).toBe("DUPLICATE");
    expect(L.balance(B, C)).toBe(100);
    expect(L.ledger(B, C).filter((t) => t.type === "REDEEM")).toHaveLength(1);
  });
});

describe("reward catalogue", () => {
  let cat: RewardCatalog;
  beforeEach(() => {
    L = new LoyaltyLedger(() => T); cat = new RewardCatalog(L, () => T);
    cat.create({ id: "d50", businessId: B, name: "₹50 off", type: "DISCOUNT", pointsCost: 500, discountPaise: R(50), quantity: 1, active: true }, "OWNER");
    give(1200);
  });
  it("staff cannot create rewards; percentage rewards need a cap", () => {
    expect(() => cat.create({ id: "x", businessId: B, name: "x", type: "DISCOUNT", pointsCost: 1, discountPaise: 1, active: true }, "STAFF")).toThrow(LoyaltyPermissionError);
    expect(() => cat.create({ id: "p", businessId: B, name: "10%", type: "PERCENT_DISCOUNT", pointsCost: 1000, percentBps: 1000, active: true }, "OWNER")).toThrow();
    expect(rewardDiscount({ id: "p", businessId: B, name: "", type: "PERCENT_DISCOUNT", pointsCost: 1, percentBps: 1000, maxDiscountPaise: R(100), active: true }, R(5000))).toBe(R(100));
  });
  it("hold -> commit debits once; failed payment releases the hold", () => {
    const r = cat.start({ redemptionId: "r1", rewardId: "d50", businessId: B, customerId: C, billId: "b1" });
    expect(L.balance(B, C)).toBe(1200); expect(L.available(B, C)).toBe(700);
    cat.cancel("r1"); expect(L.available(B, C)).toBe(1200);
    cat.start({ redemptionId: "r2", rewardId: "d50", businessId: B, customerId: C, billId: "b2" });
    cat.commit("r2", "pay"); cat.commit("r2", "pay");
    expect(L.balance(B, C)).toBe(700); expect(r.code).toBe("RDM-r1");
  });
  it("stock is limited and cannot be double redeemed", () => {
    cat.start({ redemptionId: "r1", rewardId: "d50", businessId: B, customerId: C, billId: "b1" });
    expect(() => cat.start({ redemptionId: "r2", rewardId: "d50", businessId: B, customerId: C, billId: "b2" })).toThrow(LoyaltyLimitError);
    cat.commit("r1", "p");
    expect(cat.listAvailable(B, C)).toHaveLength(0);
  });
  it("cannot redeem without enough available points", () => {
    expect(() => { cat.start({ redemptionId: "r1", rewardId: "d50", businessId: B, customerId: C, billId: "b" }); cat.start({ redemptionId: "r2", rewardId: "d50", businessId: B, customerId: C, billId: "b" }); }).toThrow();
  });
});
