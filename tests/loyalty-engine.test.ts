import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETTINGS,
  checkRedeemable,
  normalizePhone,
  pointsForBill,
  reversalPoints,
  rewardDiscountPaise,
  type RewardRule,
} from "@/server/modules/loyalty-db/engine";

// Addendum §2: food ₹900 + tax ₹100 = ₹1,000, 1 point per ₹10, GST excluded -> 90 points.
const bill = { subtotalPaise: 90000, gstPaise: 10000, serviceChargePaise: 0, discountPaise: 0, totalPaise: 100000 };

const reward = (over: Partial<RewardRule> = {}): RewardRule => ({
  type: "fixed_discount", pointsCost: 500, valuePaise: 5000, percent: null, maxDiscountPaise: null,
  active: true, validFrom: null, validTo: null, quantity: null, used: 0, ...over,
});

describe("earning", () => {
  it("matches the Addendum example (90 points)", () => {
    expect(pointsForBill(bill, DEFAULT_SETTINGS)).toBe(90);
  });
  it("includes GST when the owner chooses to", () => {
    expect(pointsForBill(bill, { ...DEFAULT_SETTINGS, excludeGst: false })).toBe(100);
  });
  it("removes discounts first when configured", () => {
    const d = { ...bill, discountPaise: 10000, totalPaise: 90000 };
    expect(pointsForBill(d, DEFAULT_SETTINGS)).toBe(80);
    expect(pointsForBill(d, { ...DEFAULT_SETTINGS, discountBeforePoints: false })).toBe(90);
  });
  it("honours minimum bill, cap and disabled program", () => {
    expect(pointsForBill(bill, { ...DEFAULT_SETTINGS, minBillPaise: 200000 })).toBe(0);
    expect(pointsForBill(bill, { ...DEFAULT_SETTINGS, maxPointsPerBill: 50 })).toBe(50);
    expect(pointsForBill(bill, { ...DEFAULT_SETTINGS, enabled: false })).toBe(0);
  });
  it("uses the owner's rate, not a hard-coded one", () => {
    expect(pointsForBill(bill, { ...DEFAULT_SETTINGS, earnSpendPaise: 10000 })).toBe(9);
  });
});

describe("redemption", () => {
  it("computes fixed and capped percentage discounts", () => {
    expect(rewardDiscountPaise(reward(), 100000)).toBe(5000);
    expect(rewardDiscountPaise(reward({ valuePaise: 999999 }), 100000)).toBe(100000);
    const pct = reward({ type: "percent_discount", valuePaise: null, percent: 10, maxDiscountPaise: 5000 });
    expect(rewardDiscountPaise(pct, 100000)).toBe(5000);
    expect(rewardDiscountPaise(pct, 20000)).toBe(2000);
    expect(rewardDiscountPaise(reward({ type: "free_item" }), 100000)).toBe(0);
  });
  it("never lets a customer redeem points they do not have", () => {
    const now = new Date();
    expect(checkRedeemable(reward(), 499, DEFAULT_SETTINGS, now).ok).toBe(false);
    expect(checkRedeemable(reward(), 500, DEFAULT_SETTINGS, now).ok).toBe(true);
    expect(checkRedeemable(reward({ active: false }), 9999, DEFAULT_SETTINGS, now).ok).toBe(false);
    expect(checkRedeemable(reward({ quantity: 3, used: 3 }), 9999, DEFAULT_SETTINGS, now).ok).toBe(false);
    expect(checkRedeemable(reward({ validTo: new Date(0) }), 9999, DEFAULT_SETTINGS, now).ok).toBe(false);
  });
});

describe("refund reversal", () => {
  it("reverses proportionally and only the extra on a second refund", () => {
    expect(reversalPoints({ earned: 90, alreadyReversed: 0, refundedPaise: 50000, paidPaise: 100000 })).toBe(45);
    expect(reversalPoints({ earned: 90, alreadyReversed: 45, refundedPaise: 100000, paidPaise: 100000 })).toBe(45);
    expect(reversalPoints({ earned: 90, alreadyReversed: 90, refundedPaise: 100000, paidPaise: 100000 })).toBe(0);
  });
});

describe("phone numbers", () => {
  it("normalises common formats and rejects junk", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
  });
});
