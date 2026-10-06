/**
 * Loyalty points ledger (v1.1 §6-12, Addendum). SEPARATE from the Pots ledger:
 * this file must not import pots-service. Points are not money.
 */
export type Paise = number;

export interface LoyaltyRule {
  businessId: string; version: number; enabled: boolean;
  /** "pointsPerBlock points for every blockPaise of eligible spend" (e.g. 1 per 10000). Never hard-coded. */
  pointsPerBlock: number; blockPaise: Paise;
  deductDiscounts: boolean; excludeGst: boolean; excludeServiceCharge: boolean; excludeDelivery: boolean; excludeTips: boolean;
  excludedCategories: string[]; excludedItemIds: string[];
  minBillPaise?: Paise; maxPointsPerBill?: number;
  /** Per-customer earning limits (Addendum §4, §11). IST calendar day / month. */
  maxPointsPerDay?: number; maxPointsPerMonth?: number;
  campaigns: { multiplierPercent: number; from: Date; to: Date }[]; // 200 = 2x
  expiryDays?: number;
  refundPolicy: "PROPORTIONAL" | "FULL_ONLY";
}
export interface BillBreakdown {
  items: { id: string; category: string; amountPaise: Paise }[];
  gstPaise: Paise; serviceChargePaise: Paise; deliveryPaise: Paise; tipPaise: Paise; discountPaise: Paise; totalPaise: Paise;
}
export type LoyaltyTxType = "EARN" | "REDEEM" | "EXPIRE" | "ADJUST" | "REFUND_REVERSAL";
export interface LoyaltyTx {
  readonly id: string; readonly businessId: string; readonly customerId: string; readonly type: LoyaltyTxType;
  readonly points: number; // signed
  readonly sourceId: string; readonly paymentId?: string; readonly reason?: string;
  readonly actorId: string; readonly createdAt: Date; readonly expiresAt?: Date; readonly ruleVersion?: number;
}
export interface RedemptionLimits {
  /** Minimum points that must be redeemed / available (Addendum §4 "minimum points required"). */
  minPoints?: number; maxPointsPerDay?: number; maxPointsPerMonth?: number;
}
type HoldStatus = "HELD" | "COMMITTED" | "CANCELLED" | "RESTORED";
export class InsufficientPointsError extends Error {}
export class LoyaltyPermissionError extends Error {}
export class LoyaltyLimitError extends Error {}

const IST_MS = 330 * 60 * 1000;
const dayKey = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const monthKey = (d: Date) => dayKey(d).slice(0, 7);

export function eligibleSpend(rule: LoyaltyRule, b: BillBreakdown): Paise {
  const excl = new Set(rule.excludedItemIds), cats = new Set(rule.excludedCategories);
  let base = b.items.filter((i) => !excl.has(i.id) && !cats.has(i.category)).reduce((a, i) => a + i.amountPaise, 0);
  if (!rule.excludeGst) base += b.gstPaise;
  if (!rule.excludeServiceCharge) base += b.serviceChargePaise;
  if (!rule.excludeDelivery) base += b.deliveryPaise;
  if (!rule.excludeTips) base += b.tipPaise;
  if (rule.deductDiscounts) base -= b.discountPaise;
  return Math.max(0, base);
}
export function calcPoints(rule: LoyaltyRule, b: BillBreakdown, at: Date): { eligible: Paise; points: number } {
  if (!rule.enabled) return { eligible: 0, points: 0 };
  const eligible = eligibleSpend(rule, b);
  if (rule.minBillPaise !== undefined && b.totalPaise < rule.minBillPaise) return { eligible, points: 0 };
  if (!(rule.blockPaise > 0)) throw new Error("blockPaise must be > 0");
  let points = Math.floor(eligible / rule.blockPaise) * rule.pointsPerBlock;
  const camp = rule.campaigns.filter((c) => at >= c.from && at <= c.to).reduce((m, c) => Math.max(m, c.multiplierPercent), 100);
  points = Math.floor((points * camp) / 100);
  if (rule.maxPointsPerBill !== undefined) points = Math.min(points, rule.maxPointsPerBill);
  return { eligible, points };
}

export class LoyaltyLedger {
  private txs: LoyaltyTx[] = [];
  private keys = new Set<string>();
  private holds = new Map<string, { businessId: string; customerId: string; points: number; status: HoldStatus; billId: string; paymentId?: string }>();
  private suspended = new Set<string>();
  readonly audit: { actorId: string; action: string; at: Date; detail: unknown }[] = [];
  private seq = 0;
  constructor(private clock: () => Date = () => new Date()) {}

  private push(t: Omit<LoyaltyTx, "id" | "createdAt">, key: string, at?: Date): LoyaltyTx | null {
    if (this.keys.has(key)) return null;
    const tx = Object.freeze({ ...t, id: `ltx_${++this.seq}`, createdAt: at ?? this.clock() });
    this.txs.push(tx); this.keys.add(key);
    this.audit.push({ actorId: t.actorId, action: t.type, at: tx.createdAt, detail: { points: t.points, sourceId: t.sourceId, reason: t.reason } });
    return tx;
  }
  ledger(businessId: string, customerId: string): readonly LoyaltyTx[] { return this.txs.filter((t) => t.businessId === businessId && t.customerId === customerId); }
  /** Balance is always derived from the ledger. */
  balance(businessId: string, customerId: string): number { return this.ledger(businessId, customerId).reduce((a, t) => a + t.points, 0); }
  held(businessId: string, customerId: string): number {
    let s = 0; for (const h of this.holds.values()) if (h.businessId === businessId && h.customerId === customerId && h.status === "HELD") s += h.points; return s;
  }
  available(businessId: string, customerId: string) { return this.balance(businessId, customerId) - this.held(businessId, customerId); }
  suspend(businessId: string, customerId: string) { this.suspended.add(`${businessId}:${customerId}`); }
  unsuspend(businessId: string, customerId: string) { this.suspended.delete(`${businessId}:${customerId}`); }
  isSuspended(businessId: string, customerId: string) { return this.suspended.has(`${businessId}:${customerId}`); }
  /** Points moved by `types` for this customer inside the same IST day / month as `at`. */
  private sumWindow(businessId: string, customerId: string, types: LoyaltyTxType[], at: Date, window: "day" | "month"): number {
    const key = window === "day" ? dayKey : monthKey; const k = key(at);
    return Math.abs(this.ledger(businessId, customerId).filter((t) => types.includes(t.type) && key(t.createdAt) === k).reduce((a, t) => a + t.points, 0));
  }

  /** Earn exactly once per bill, only after successful payment. */
  earn(i: { rule: LoyaltyRule; customerId: string; billId: string; paymentId: string; paymentStatus: "SUCCESS" | "PENDING" | "FAILED"; bill: BillBreakdown; at?: Date; actorId?: string }) {
    const { rule } = i; const at = i.at ?? this.clock();
    if (i.paymentStatus !== "SUCCESS") return { status: "NOT_ELIGIBLE" as const, points: 0 };
    if (this.suspended.has(`${rule.businessId}:${i.customerId}`)) return { status: "NOT_ELIGIBLE" as const, points: 0 };
    let { points } = calcPoints(rule, i.bill, at);
    if (points <= 0) return { status: "NOT_ELIGIBLE" as const, points: 0 };
    // Per-customer daily / monthly earning limits.
    if (rule.maxPointsPerDay !== undefined) points = Math.min(points, Math.max(0, rule.maxPointsPerDay - this.sumWindow(rule.businessId, i.customerId, ["EARN"], at, "day")));
    if (rule.maxPointsPerMonth !== undefined) points = Math.min(points, Math.max(0, rule.maxPointsPerMonth - this.sumWindow(rule.businessId, i.customerId, ["EARN"], at, "month")));
    if (points <= 0) return { status: "LIMIT_REACHED" as const, points: 0 };
    const tx = this.push({
      businessId: rule.businessId, customerId: i.customerId, type: "EARN", points, sourceId: i.billId, paymentId: i.paymentId,
      actorId: i.actorId ?? "system", expiresAt: rule.expiryDays ? new Date(at.getTime() + rule.expiryDays * 86400000) : undefined, ruleVersion: rule.version,
    }, `earn:${rule.businessId}:${i.billId}`, at);
    return tx ? { status: "EARNED" as const, points, tx } : { status: "DUPLICATE" as const, points: 0 };
  }

  requestRedemption(i: { redemptionId: string; businessId: string; customerId: string; points: number; billId: string; at?: Date; limits?: RedemptionLimits }) {
    if (!Number.isInteger(i.points) || i.points <= 0) throw new Error("invalid points");
    if (this.holds.has(i.redemptionId)) return this.holds.get(i.redemptionId)!;
    if (this.isSuspended(i.businessId, i.customerId)) throw new LoyaltyPermissionError("loyalty account is suspended");
    const at = i.at ?? this.clock(); const lim = i.limits;
    if (lim?.minPoints !== undefined && i.points < lim.minPoints) throw new LoyaltyLimitError(`minimum ${lim.minPoints} points required to redeem`);
    if (lim?.maxPointsPerDay !== undefined && this.sumWindow(i.businessId, i.customerId, ["REDEEM"], at, "day") + this.held(i.businessId, i.customerId) + i.points > lim.maxPointsPerDay) throw new LoyaltyLimitError("daily redemption limit reached");
    if (lim?.maxPointsPerMonth !== undefined && this.sumWindow(i.businessId, i.customerId, ["REDEEM"], at, "month") + this.held(i.businessId, i.customerId) + i.points > lim.maxPointsPerMonth) throw new LoyaltyLimitError("monthly redemption limit reached");
    if (this.available(i.businessId, i.customerId) < i.points) throw new InsufficientPointsError("not enough available points");
    const h = { businessId: i.businessId, customerId: i.customerId, points: i.points, status: "HELD" as HoldStatus, billId: i.billId };
    this.holds.set(i.redemptionId, h); return h;
  }
  /** Call only once the bill/payment is safely committed. */
  commitRedemption(redemptionId: string, paymentId: string, actorId = "system") {
    const h = this.holds.get(redemptionId); if (!h) throw new Error("redemption not found");
    if (h.status === "COMMITTED") return { duplicate: true };
    if (h.status !== "HELD") throw new Error("redemption not active");
    if (this.isSuspended(h.businessId, h.customerId)) throw new LoyaltyPermissionError("loyalty account is suspended");
    if (this.balance(h.businessId, h.customerId) < h.points) throw new InsufficientPointsError("balance would go negative");
    this.push({ businessId: h.businessId, customerId: h.customerId, type: "REDEEM", points: -h.points, sourceId: redemptionId, paymentId, actorId }, `redeem:${redemptionId}`);
    h.status = "COMMITTED"; h.paymentId = paymentId; return { duplicate: false };
  }
  /**
   * Refund policy "restore redeemed points" (v1.1 §10): a committed redemption on a refunded bill is
   * reversed by a NEW positive REFUND_REVERSAL row; the original REDEEM row is never touched.
   */
  restoreRedemption(i: { redemptionId: string; refundId: string; actorId?: string; at?: Date }) {
    const h = this.holds.get(i.redemptionId);
    if (!h) throw new Error("redemption not found");
    if (h.status === "RESTORED") return { status: "DUPLICATE" as const, restored: 0 };
    if (h.status !== "COMMITTED") return { status: "NOT_COMMITTED" as const, restored: 0 };
    const tx = this.push({ businessId: h.businessId, customerId: h.customerId, type: "REFUND_REVERSAL", points: h.points, sourceId: i.refundId, paymentId: h.paymentId, reason: "redeemed points restored after refund", actorId: i.actorId ?? "system" }, `restore:${i.redemptionId}`, i.at);
    h.status = "RESTORED";
    return tx ? { status: "RESTORED" as const, restored: h.points, tx } : { status: "DUPLICATE" as const, restored: 0 };
  }
  cancelRedemption(redemptionId: string) { const h = this.holds.get(redemptionId); if (h && h.status === "HELD") h.status = "CANCELLED"; }

  adjust(i: { businessId: string; customerId: string; adjustmentId: string; points: number; reason: string; actorId: string; role: "OWNER" | "MANAGER" | "STAFF"; largeThreshold?: number }) {
    if (i.role === "STAFF") throw new LoyaltyPermissionError("staff cannot create points");
    if (!i.reason.trim()) throw new Error("reason required");
    if (!Number.isSafeInteger(i.points) || i.points === 0) throw new Error("adjustment must be a non-zero whole number of points");
    if (i.role === "MANAGER" && Math.abs(i.points) > (i.largeThreshold ?? 100)) throw new LoyaltyPermissionError("large adjustment needs owner");
    if (i.points < 0 && this.available(i.businessId, i.customerId) + i.points < 0) throw new InsufficientPointsError("balance would go negative");
    return this.push({ businessId: i.businessId, customerId: i.customerId, type: "ADJUST", points: i.points, sourceId: i.adjustmentId, reason: i.reason, actorId: i.actorId }, `adjust:${i.adjustmentId}`);
  }

  /** FIFO: expire unconsumed points of batches past expiresAt, never below zero. */
  expire(businessId: string, customerId: string, now: Date) {
    const l = this.ledger(businessId, customerId);
    let debit = -l.filter((t) => t.points < 0).reduce((a, t) => a + t.points, 0);
    const earns = l.filter((t) => t.type === "EARN").sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
    let total = 0;
    for (const e of earns) {
      const used = Math.min(debit, e.points); debit -= used;
      const left = e.points - used;
      if (e.expiresAt && e.expiresAt <= now && left > 0) {
        const amt = Math.min(left, this.balance(businessId, customerId));
        if (amt > 0 && this.push({ businessId, customerId, type: "EXPIRE", points: -amt, sourceId: e.id, actorId: "system" }, `expire:${e.id}`)) total += amt;
      }
    }
    return total;
  }

  /** Reverse points for a refunded bill; original EARN row is untouched. */
  refundReversal(i: { businessId: string; customerId: string; billId: string; refundId: string; refundedPaise: Paise; billPaise: Paise; policy: "PROPORTIONAL" | "FULL_ONLY"; actorId?: string }) {
    if (this.keys.has(`refund:${i.refundId}`)) return { status: "DUPLICATE" as const, reversed: 0 };
    const earn = this.ledger(i.businessId, i.customerId).find((t) => t.type === "EARN" && t.sourceId === i.billId);
    if (!earn) return { status: "NO_POINTS_EARNED" as const, reversed: 0 };
    const already = -this.ledger(i.businessId, i.customerId).filter((t) => t.type === "REFUND_REVERSAL" && t.paymentId === earn.paymentId).reduce((a, t) => a + t.points, 0);
    const full = i.refundedPaise >= i.billPaise;
    const target = i.policy === "FULL_ONLY" ? (full ? earn.points : 0) : full ? earn.points : Math.floor((earn.points * i.refundedPaise) / i.billPaise);
    const want = Math.max(0, Math.min(target - already, earn.points - already));
    const reversed = Math.min(want, this.balance(i.businessId, i.customerId)); // never negative
    if (reversed <= 0) return { status: "NOTHING_TO_REVERSE" as const, reversed: 0, unrecovered: want };
    const tx = this.push({ businessId: i.businessId, customerId: i.customerId, type: "REFUND_REVERSAL", points: -reversed, sourceId: i.refundId, paymentId: earn.paymentId, reason: "bill refunded", actorId: i.actorId ?? "system" }, `refund:${i.refundId}`);
    return tx ? { status: "REVERSED" as const, reversed, unrecovered: want - reversed } : { status: "DUPLICATE" as const, reversed: 0 };
  }
}
