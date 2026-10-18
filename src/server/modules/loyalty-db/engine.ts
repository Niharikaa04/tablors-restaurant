/**
 * Pure loyalty rules (no database, no server-only imports) so they are unit
 * tested directly. Money is integer paise. Rules come from the owner's
 * settings, never from constants here, except DEFAULT_SETTINGS, which are the
 * Addendum's own worked example and are used only until the owner saves
 * settings.
 */

export type LoyaltySettings = {
  enabled: boolean;
  /** Earn `earnPoints` for every `earnSpendPaise` of eligible spend (₹10 → 1000). */
  earnSpendPaise: number;
  earnPoints: number;
  excludeGst: boolean;
  excludeServiceCharge: boolean;
  /** If true, discounts (including reward discounts) are removed before points are calculated. */
  discountBeforePoints: boolean;
  minBillPaise: number;
  maxPointsPerBill: number | null;
  /** Points expire this many months after they are earned; null = never. */
  expiryMonths: number | null;
  minPointsToRedeem: number;
};

export const DEFAULT_SETTINGS: LoyaltySettings = {
  enabled: true,
  earnSpendPaise: 1000,
  earnPoints: 1,
  excludeGst: true,
  excludeServiceCharge: true,
  discountBeforePoints: true,
  minBillPaise: 0,
  maxPointsPerBill: null,
  expiryMonths: null,
  minPointsToRedeem: 0,
};

export type BillAmounts = {
  subtotalPaise: number;
  gstPaise: number;
  serviceChargePaise: number;
  discountPaise: number;
  totalPaise: number;
};

/** The part of the bill that counts towards points, per the owner's settings. */
export function eligibleSpendPaise(bill: BillAmounts, s: LoyaltySettings): number {
  let base = bill.subtotalPaise;
  if (!s.excludeServiceCharge) base += bill.serviceChargePaise;
  if (!s.excludeGst) base += bill.gstPaise;
  if (s.discountBeforePoints) base -= bill.discountPaise;
  return Math.max(0, Math.min(base, bill.totalPaise));
}

export function pointsForBill(bill: BillAmounts, s: LoyaltySettings): number {
  if (!s.enabled) return 0;
  if (s.earnSpendPaise <= 0 || s.earnPoints <= 0) return 0;
  if (bill.totalPaise < s.minBillPaise) return 0;

  const raw = Math.floor(eligibleSpendPaise(bill, s) / s.earnSpendPaise) * s.earnPoints;
  return s.maxPointsPerBill === null ? raw : Math.min(raw, s.maxPointsPerBill);
}

export type RewardType = "fixed_discount" | "percent_discount" | "free_item" | "coupon" | "experience";

export type RewardRule = {
  type: RewardType;
  pointsCost: number;
  valuePaise: number | null;
  percent: number | null;
  maxDiscountPaise: number | null;
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  /** Total redeemable units; null = unlimited. */
  quantity: number | null;
  /** Units already held or committed. */
  used: number;
};

/** Discount a reward takes off the bill. Free items, coupons and experiences are entitlements (₹0 off here). */
export function rewardDiscountPaise(r: RewardRule, billTotalPaise: number): number {
  if (r.type === "fixed_discount") {
    return Math.max(0, Math.min(r.valuePaise ?? 0, billTotalPaise));
  }
  if (r.type === "percent_discount") {
    const pct = Math.min(Math.max(r.percent ?? 0, 0), 100);
    const raw = Math.floor((billTotalPaise * pct) / 100);
    return Math.max(0, Math.min(raw, r.maxDiscountPaise ?? raw, billTotalPaise));
  }
  return 0;
}

export type RedeemCheck = { ok: true } | { ok: false; reason: string };

export function checkRedeemable(
  r: RewardRule,
  availablePoints: number,
  s: LoyaltySettings,
  now: Date
): RedeemCheck {
  if (!s.enabled) return { ok: false, reason: "The loyalty program is switched off." };
  if (!r.active) return { ok: false, reason: "This reward isn't available." };
  if (r.validFrom && now < r.validFrom) return { ok: false, reason: "This reward hasn't started yet." };
  if (r.validTo && now > r.validTo) return { ok: false, reason: "This reward has expired." };
  if (r.quantity !== null && r.used >= r.quantity) return { ok: false, reason: "This reward is fully claimed." };
  if (availablePoints < Math.max(r.pointsCost, s.minPointsToRedeem)) {
    return { ok: false, reason: "Not enough points." };
  }
  return { ok: true };
}

/**
 * Points to take back for a (possibly partial) refund. Cumulative, so
 * calling it again after a second refund returns only the extra amount.
 */
export function reversalPoints(input: {
  earned: number;
  alreadyReversed: number;
  refundedPaise: number;
  paidPaise: number;
}): number {
  if (input.earned <= 0 || input.paidPaise <= 0) return 0;
  const ratio = Math.min(input.refundedPaise / input.paidPaise, 1);
  const target = Math.ceil(input.earned * ratio);
  return Math.max(0, Math.min(target, input.earned) - input.alreadyReversed);
}

/** 10-digit Indian mobile number from common formats (+91, 0, spaces, dashes), else null. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function maskPhone(phone: string): string {
  return phone.length >= 10 ? `${phone.slice(0, 2)}••••••${phone.slice(-2)}` : phone;
}
