import { LoyaltyLedger, LoyaltyLimitError, LoyaltyPermissionError, type RedemptionLimits, type Paise } from "./loyalty";

/**
 * Reward catalogue + redemption lifecycle (v1.1 §6.4-6.5, Addendum §5 and §8).
 * Sits on top of LoyaltyLedger: points are only held at start, debited on commit,
 * released on cancel. Like loyalty.ts it never touches the Pots ledger.
 */
export type RewardType = "DISCOUNT" | "PERCENT_DISCOUNT" | "FREE_ITEM" | "FREE_UPGRADE" | "EXPERIENCE" | "COUPON";

export interface Reward {
  id: string; businessId: string; name: string; type: RewardType;
  pointsCost: number;
  /** Minimum points a customer must hold to redeem (defaults to pointsCost). */
  minPointsRequired?: number;
  /** DISCOUNT / COUPON: fixed value. */
  discountPaise?: Paise;
  /** PERCENT_DISCOUNT: basis points (1000 = 10%) with a mandatory cap. */
  percentBps?: number; maxDiscountPaise?: Paise;
  itemId?: string;
  /** Remaining stock. undefined/null = unlimited. */
  quantity?: number | null;
  validFrom?: Date; validTo?: Date; active: boolean; terms?: string;
}

export type RedemptionStatus = "HELD" | "COMMITTED" | "CANCELLED";
export interface RewardRedemption {
  id: string; businessId: string; customerId: string; rewardId: string; billId: string;
  points: number; status: RedemptionStatus; code: string; paymentId?: string;
}

export function rewardDiscount(r: Reward, billPaise: Paise): Paise {
  if (r.type === "DISCOUNT" || r.type === "COUPON") return Math.min(r.discountPaise ?? 0, billPaise);
  if (r.type === "PERCENT_DISCOUNT") {
    const raw = Math.floor((billPaise * (r.percentBps ?? 0)) / 10000);
    return Math.min(raw, r.maxDiscountPaise ?? 0, billPaise); // a percentage reward MUST have a max
  }
  return 0; // FREE_ITEM / FREE_UPGRADE / EXPERIENCE: applied by billing as an entitlement, not a money discount
}

export class RewardCatalog {
  private rewards = new Map<string, Reward>();
  private redemptions = new Map<string, RewardRedemption>();
  private pending = new Map<string, number>(); // rewardId -> units currently on hold
  constructor(private ledger: LoyaltyLedger, private clock: () => Date = () => new Date()) {}

  create(r: Reward, role: "OWNER" | "MANAGER" | "STAFF"): Reward {
    if (role === "STAFF") throw new LoyaltyPermissionError("staff cannot manage the reward catalogue");
    if (!Number.isInteger(r.pointsCost) || r.pointsCost <= 0) throw new Error("pointsCost must be a positive whole number");
    if (r.type === "PERCENT_DISCOUNT" && (!r.maxDiscountPaise || !r.percentBps || r.percentBps > 10000)) throw new Error("percentage reward needs percentBps <= 10000 and a maximum discount");
    if ((r.type === "DISCOUNT" || r.type === "COUPON") && !(r.discountPaise && r.discountPaise > 0)) throw new Error("discount reward needs discountPaise > 0");
    if (this.rewards.has(r.id)) throw new Error("reward id already exists");
    const frozen = Object.freeze({ ...r }); this.rewards.set(r.id, { ...frozen }); return frozen;
  }
  get(id: string) { return this.rewards.get(id); }
  list(businessId: string): Reward[] { return [...this.rewards.values()].filter((r) => r.businessId === businessId); }
  /** Rewards the customer could redeem right now. */
  listAvailable(businessId: string, customerId: string, at = this.clock()): Reward[] {
    const avail = this.ledger.available(businessId, customerId);
    return [...this.rewards.values()].filter((r) => r.businessId === businessId && this.isOffered(r, at) && avail >= (r.minPointsRequired ?? r.pointsCost));
  }
  private isOffered(r: Reward, at: Date) {
    if (!r.active) return false;
    if (r.validFrom && at < r.validFrom) return false;
    if (r.validTo && at > r.validTo) return false;
    if (r.quantity != null && r.quantity - (this.pending.get(r.id) ?? 0) <= 0) return false;
    return true;
  }

  start(i: { redemptionId: string; rewardId: string; businessId: string; customerId: string; billId: string; at?: Date; limits?: Omit<RedemptionLimits, "minPoints"> }): RewardRedemption {
    const existing = this.redemptions.get(i.redemptionId); if (existing) return existing; // idempotent
    const at = i.at ?? this.clock();
    const r = this.rewards.get(i.rewardId);
    if (!r || r.businessId !== i.businessId) throw new Error("reward not found");
    if (!this.isOffered(r, at)) throw new LoyaltyLimitError("reward is not available");
    // Hold first; if the ledger refuses (insufficient / suspended / limits) nothing is reserved.
    this.ledger.requestRedemption({ redemptionId: i.redemptionId, businessId: i.businessId, customerId: i.customerId, points: r.pointsCost, billId: i.billId, at, limits: { ...i.limits, minPoints: r.minPointsRequired ?? r.pointsCost } });
    this.pending.set(r.id, (this.pending.get(r.id) ?? 0) + 1);
    const red: RewardRedemption = { id: i.redemptionId, businessId: i.businessId, customerId: i.customerId, rewardId: r.id, billId: i.billId, points: r.pointsCost, status: "HELD", code: `RDM-${i.redemptionId}` };
    this.redemptions.set(red.id, red); return red;
  }
  /** Only once the bill/payment is safely committed. */
  commit(redemptionId: string, paymentId: string): RewardRedemption {
    const red = this.must(redemptionId);
    if (red.status === "COMMITTED") return red;
    if (red.status !== "HELD") throw new Error("redemption not active");
    this.ledger.commitRedemption(redemptionId, paymentId);
    const r = this.rewards.get(red.rewardId)!;
    if (r.quantity != null) r.quantity -= 1;
    this.pending.set(r.id, Math.max(0, (this.pending.get(r.id) ?? 1) - 1));
    red.status = "COMMITTED"; red.paymentId = paymentId; return red;
  }
  /** Payment failed / bill cancelled: release the hold, points are untouched. */
  cancel(redemptionId: string): RewardRedemption {
    const red = this.must(redemptionId);
    if (red.status !== "HELD") return red;
    this.ledger.cancelRedemption(redemptionId);
    this.pending.set(red.rewardId, Math.max(0, (this.pending.get(red.rewardId) ?? 1) - 1));
    red.status = "CANCELLED"; return red;
  }
  private must(id: string) { const r = this.redemptions.get(id); if (!r) throw new Error("redemption not found"); return r; }
}
