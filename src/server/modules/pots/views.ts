import { formatINR, type Paise } from "./money";
import { selectActiveRules, type AllocationRule } from "./rules";
import { DEMO_BUSINESS_ID, type PotsRuntime } from "./runtime";
import type { Pot } from "./support";

/**
 * Read-only view models for the owner Pots screens. Everything is derived from the
 * ledger and the rule registry; nothing here stores or hard-codes a figure.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;

/** "Today" for the owner is the Indian calendar day. */
export function istDayBounds(now: Date): [Date, Date] {
  const shifted = now.getTime() + IST_OFFSET_MS;
  const start = Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return [new Date(start), new Date(start + DAY_MS)];
}
/** Same UTC month window the allocation engine uses for MONTHLY_TARGET (switch both to IST later). */
export function monthBoundsUTC(at: Date): [Date, Date] {
  return [new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)), new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1))];
}

/** URL slug keeps the old /owner/pots/<slug> links working (gst, salary, service-charges, owner-profit...). */
export function potSlug(p: Pot): string {
  return p.type === "CUSTOM" ? encodeURIComponent(p.id) : p.type.toLowerCase().replace(/_/g, "-");
}
export function findPotBySlug(rt: PotsRuntime, slug: string): Pot | undefined {
  const s = decodeURIComponent(slug);
  return rt.pots.find((p) => potSlug(p) === slug || p.id === s);
}

export function describeRuleValue(r: Pick<AllocationRule, "method" | "value">): string {
  switch (r.method) {
    case "PERCENTAGE": return `${(r.value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}% of eligible payment`;
    case "FIXED": return `${formatINR(r.value)} per payment`;
    case "MONTHLY_TARGET": return `${formatINR(r.value)} monthly target`;
    case "REMAINING": return "Whatever remains after other rules";
  }
}

export type PotStatus = "NO_RULE" | "COLLECTING" | "TARGET_MET";
export const STATUS_LABEL: Record<PotStatus, string> = {
  NO_RULE: "No active rule",
  COLLECTING: "Collecting",
  TARGET_MET: "Monthly target met",
};

export interface PotCard {
  slug: string;
  pot: Pot;
  balance: Paise;
  status: PotStatus;
  targetPaise?: Paise;
  progressPercent?: number;
  allocatedThisMonth: Paise;
  activeRuleCount: number;
}

function cardFor(rt: PotsRuntime, pot: Pot, active: AllocationRule[], now: Date): PotCard {
  const B = DEMO_BUSINESS_ID;
  const mine = active.filter((r) => r.potId === pot.id);
  const target = mine.find((r) => r.method === "MONTHLY_TARGET");
  const [mFrom, mTo] = monthBoundsUTC(now);
  const allocatedThisMonth = rt.ledger.allocatedToPot(B, pot.id, mFrom, mTo);
  const progressPercent = target && target.value > 0 ? Math.min(100, Math.floor((allocatedThisMonth * 100) / target.value)) : undefined;
  const status: PotStatus = mine.length === 0 ? "NO_RULE" : progressPercent === 100 ? "TARGET_MET" : "COLLECTING";
  return {
    slug: potSlug(pot), pot, balance: rt.ledger.potBalance(B, pot.id), status,
    targetPaise: target?.value, progressPercent, allocatedThisMonth, activeRuleCount: mine.length,
  };
}

export function buildDashboard(rt: PotsRuntime, now = new Date()) {
  const B = DEMO_BUSINESS_ID;
  const [dayFrom, dayTo] = istDayBounds(now);
  const s = rt.ledger.summary(B, dayFrom, dayTo, rt.potIds);
  const rec = rt.ledger.reconcile(B, rt.potIds);
  const active = selectActiveRules(rt.registry.forBusiness(B), B, now);
  return {
    totals: {
      totalSettledBalance: s.totalSettledBalance,
      collectedToday: s.salesInRange,
      allocatedToPots: s.allocatedToPots,
      unallocated: s.unallocated,
    },
    reconciliation: rec,
    cards: rt.pots.map((p) => cardFor(rt, p, active, now)),
    alerts: rt.alerts.list(B).slice(-5).reverse(),
    exceptions: rt.payments.exceptions.filter((e) => e.businessId === B).slice(-5).reverse(),
    hasAnyRule: active.length > 0,
  };
}

const SOURCE_LABEL: Record<string, string> = {
  ALLOCATION: "Payment allocation",
  ALLOCATION_REVERSAL: "Refund reversal",
  PAYOUT: "Payout",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Owner adjustment",
  PAYMENT_RECEIVED: "Payment received",
  REFUND_PAYOUT: "Refund",
};

export function buildPotView(rt: PotsRuntime, slug: string, now = new Date()) {
  const B = DEMO_BUSINESS_ID;
  const pot = findPotBySlug(rt, slug);
  if (!pot) return null;
  const all = rt.registry.forBusiness(B);
  const active = selectActiveRules(all, B, now);
  let running = 0;
  const transactions = rt.ledger.potEntries(B, pot.id).map((e) => ({
    id: e.id, at: e.createdAt, amount: e.amount, balanceAfter: (running += e.amount),
    label: SOURCE_LABEL[e.sourceType] ?? e.sourceType, sourceId: e.sourceId,
    ruleId: e.ruleId, ruleVersion: e.ruleVersion, reason: e.reason,
  }));
  return {
    card: cardFor(rt, pot, active, now),
    activeRules: active.filter((r) => r.potId === pot.id),
    ruleHistory: all.filter((r) => r.potId === pot.id).slice().sort((a, b) => a.ruleKey.localeCompare(b.ruleKey) || b.version - a.version),
    transactions: transactions.slice().reverse(), // newest first; balanceAfter is chronological
  };
}

export function buildRulesView(rt: PotsRuntime, now = new Date()) {
  const B = DEMO_BUSINESS_ID;
  const all = rt.registry.forBusiness(B);
  const latest = new Map<string, AllocationRule>();
  for (const r of all) { const c = latest.get(r.ruleKey); if (!c || r.version > c.version) latest.set(r.ruleKey, r); }
  const activeIds = new Set(selectActiveRules(all, B, now).map((r) => r.id));
  return {
    pots: rt.pots,
    rules: [...latest.values()].sort((a, b) => a.priority - b.priority || a.ruleKey.localeCompare(b.ruleKey))
      .map((r) => ({ rule: r, active: activeIds.has(r.id), potName: rt.pots.find((p) => p.id === r.potId)?.name ?? r.potId, summary: describeRuleValue(r) })),
    versionsByKey: Object.fromEntries([...latest.keys()].map((k) => [k, all.filter((r) => r.ruleKey === k).length])),
  };
}

export interface TransactionRow {
  id: string; at: Date; journalId: string; account: string; amount: Paise;
  label: string; sourceId: string; reason?: string; ruleId?: string; ruleVersion?: number;
}
export type TransactionFilter = "ALL" | "PAYMENTS" | "ALLOCATIONS" | "REFUNDS" | "PAYOUTS";
const FILTER_SOURCES: Record<Exclude<TransactionFilter, "ALL">, string[]> = {
  PAYMENTS: ["PAYMENT_RECEIVED"], ALLOCATIONS: ["ALLOCATION"], REFUNDS: ["ALLOCATION_REVERSAL", "REFUND_PAYOUT"],
  PAYOUTS: ["PAYOUT", "TRANSFER", "ADJUSTMENT"],
};
/** Spec screen 13: payments, allocations, transfers, payouts, refunds and reversals, newest first, straight from the ledger. */
export function buildTransactionsView(rt: PotsRuntime, filter: TransactionFilter = "ALL") {
  const B = DEMO_BUSINESS_ID;
  const allowed = filter === "ALL" ? null : new Set(FILTER_SOURCES[filter]);
  const rows: TransactionRow[] = rt.ledger.entries(B)
    .filter((e) => !allowed || allowed.has(e.sourceType))
    .map((e) => ({
      id: e.id, at: e.createdAt, journalId: e.journalId,
      account: e.account === "SETTLEMENT" ? "Settlement" : e.account === "UNALLOCATED" ? "Unallocated" : (rt.pots.find((p) => `POT:${p.id}` === e.account)?.name ?? e.account),
      amount: e.amount, label: SOURCE_LABEL[e.sourceType] ?? e.sourceType, sourceId: e.sourceId,
      reason: e.reason, ruleId: e.ruleId, ruleVersion: e.ruleVersion,
    }))
    .reverse();
  return { filter, rows, reconciliation: rt.ledger.reconcile(B, rt.potIds), simulated: true as const };
}
