import { LoyaltyLedger, calcPoints, type BillBreakdown as BillBreakdownT, type LoyaltyRule } from "./core/loyalty";
import { RewardCatalog } from "./core/rewards";

/**
 * Process-wide LOYALTY runtime for the prototype (in-memory). Deliberately separate from the Pots
 * runtime: it never imports the Pots ledger. Both are driven by the same bill/payment id from
 * payment-hook.ts (Addendum §12).
 *
 * No loyalty rule is seeded: the earning rate is the owner's decision and is never hard-coded.
 * Until a rule is published (and enabled) no points are earned.
 */
export interface BillLink { businessId: string; customerId: string; billId: string; billPaise: number; refundedPaise: number }

export interface LoyaltyRuntime {
  ledger: LoyaltyLedger;
  catalog: RewardCatalog;
  /** Append-only list of rule versions per business. */
  rules: LoyaltyRule[];
  /** store payment id -> shared per-bill link (so partial refunds accumulate per bill). */
  links: Map<string, BillLink>;
  /** loyalty_customers: phone/member reference -> member. Phone is stored only masked for display. */
  members: Map<string, Member>;
}

export interface Member { id: string; businessId: string; name: string; phone: string; maskedPhone: string; status: "ACTIVE" | "SUSPENDED"; joinedAt: Date }

const g = globalThis as unknown as { __tablorsLoyaltyRuntime?: LoyaltyRuntime };

export function getLoyaltyRuntime(): LoyaltyRuntime {
  if (!g.__tablorsLoyaltyRuntime) {
    const ledger = new LoyaltyLedger();
    g.__tablorsLoyaltyRuntime = { ledger, catalog: new RewardCatalog(ledger), rules: [], links: new Map(), members: new Map() };
  }
  return g.__tablorsLoyaltyRuntime;
}
export function resetLoyaltyRuntimeForTests(): void { g.__tablorsLoyaltyRuntime = undefined; }

/** Publishing never edits an old version; it appends version = max + 1. Owner only. */
export function publishLoyaltyRule(rt: LoyaltyRuntime, rule: Omit<LoyaltyRule, "version">, role: "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF"): LoyaltyRule {
  if (role !== "OWNER") throw new Error("only the owner can change loyalty settings");
  const version = Math.max(0, ...rt.rules.filter((r) => r.businessId === rule.businessId).map((r) => r.version)) + 1;
  const next = Object.freeze({ ...rule, version });
  rt.rules.push(next); return next;
}
export function currentLoyaltyRule(rt: LoyaltyRuntime, businessId: string): LoyaltyRule | undefined {
  return rt.rules.filter((r) => r.businessId === businessId).reduce<LoyaltyRule | undefined>((a, b) => (!a || b.version > a.version ? b : a), undefined);
}

const maskPhone = (p: string) => (p.length <= 4 ? "****" : `${"*".repeat(p.length - 4)}${p.slice(-4)}`);

/** Customer identification at billing / loyalty enrolment. Phone number is the approved identifier. */
export function enrolMember(rt: LoyaltyRuntime, businessId: string, i: { name: string; phone: string }): Member {
  const phone = i.phone.replace(/[\s-]/g, "");
  if (!/^\+?\d{10,13}$/.test(phone)) throw new Error("enter a valid phone number");
  if (!i.name.trim()) throw new Error("name is required");
  const existing = [...rt.members.values()].find((m) => m.businessId === businessId && m.phone === phone);
  if (existing) return existing; // idempotent: one account per phone
  const m: Member = { id: `mem_${rt.members.size + 1}`, businessId, name: i.name.trim(), phone, maskedPhone: maskPhone(phone), status: "ACTIVE", joinedAt: new Date() };
  rt.members.set(m.id, m); return m;
}
export function setMemberStatus(rt: LoyaltyRuntime, memberId: string, status: "ACTIVE" | "SUSPENDED", role: string) {
  if (role !== "OWNER") throw new Error("only the owner can suspend or reinstate a member");
  const m = rt.members.get(memberId); if (!m) throw new Error("member not found");
  status === "SUSPENDED" ? rt.ledger.suspend(m.businessId, m.id) : rt.ledger.unsuspend(m.businessId, m.id);
  m.status = status;
}
/** Points the customer WOULD earn for a bill (Bill screen preview). Read-only. */
export function previewPoints(rt: LoyaltyRuntime, businessId: string, bill: BillBreakdownT, at = new Date()) {
  const rule = currentLoyaltyRule(rt, businessId);
  if (!rule) return { eligible: 0, points: 0, configured: false as const };
  return { ...calcPoints(rule, bill, at), configured: true as const };
}

/** Owner loyalty dashboard + report figures (v1.1 §13, Addendum §14). */
export function loyaltySummary(rt: LoyaltyRuntime, businessId: string, now = new Date()) {
  const members = [...rt.members.values()].filter((m) => m.businessId === businessId);
  let issued = 0, redeemed = 0, expired = 0, outstanding = 0, activeThisMonth = 0, newThisMonth = 0;
  const month = now.toISOString().slice(0, 7);
  for (const m of members) {
    const led = rt.ledger.ledger(businessId, m.id);
    for (const t of led) {
      if (t.type === "EARN" || (t.type === "ADJUST" && t.points > 0)) issued += t.points;
      if (t.type === "REDEEM") redeemed += -t.points;
      if (t.type === "EXPIRE") expired += -t.points;
    }
    outstanding += rt.ledger.balance(businessId, m.id);
    if (led.some((t) => t.createdAt.toISOString().slice(0, 7) === month)) activeThisMonth++;
    if (m.joinedAt.toISOString().slice(0, 7) === month) newThisMonth++;
  }
  return { totalMembers: members.length, activeThisMonth, newThisMonth, issued, redeemed, expired, outstanding };
}

/** Daily job: records EXPIRE transactions for points past their expiry date (never edits old rows). */
export function runExpiry(rt: LoyaltyRuntime, businessId: string, now = new Date()): number {
  let total = 0;
  for (const m of rt.members.values()) if (m.businessId === businessId) total += rt.ledger.expire(businessId, m.id, now);
  return total;
}
