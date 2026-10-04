/**
 * @deprecated Reference implementation only. The LIVE app uses the single Pots ledger in
 * `src/server/modules/pots/` (ledger, payments, payouts, payroll, permissions). Nothing in `src/app`
 * imports this file. It is kept ONLY because it still contains dispute/chargeback freezing and
 * settlement-mismatch logic (with tests) that has not yet been ported to `pots/`.
 */
import { allocate, activeRules, type AllocationAlert, type AllocationLine, type PotRule, type RuleMethod } from "./allocation-engine";
import { apportion, assertPaise, assertPositivePaise, type Paise } from "./money";

/**
 * Reference implementation of the Pots ledger semantics (in-memory).
 * A Drizzle/Postgres repository must preserve exactly these invariants:
 *  - append-only entries, journals sum to zero, unique (business, idempotency key)
 *  - no pot / unallocated / dispute-hold account may go negative
 *
 * ALL payment/payout provider behaviour here is SIMULATED (prototype mode).
 * No UPI PIN, bank password or card PIN is accepted or stored anywhere;
 * step-up auth is represented only by a boolean result from an external check.
 */

export type Role = "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF";
export type Action =
  | "RULES_CONFIGURE" | "PAYOUT_REQUEST" | "PAYOUT_APPROVE" | "PROFIT_WITHDRAW"
  | "LEDGER_VIEW" | "RECONCILE" | "POT_ADJUST" | "BILL_CREATE" | "REFUND";

const BASE_PERMISSIONS: Record<Role, Action[]> = {
  OWNER: ["RULES_CONFIGURE", "PAYOUT_REQUEST", "PAYOUT_APPROVE", "PROFIT_WITHDRAW", "LEDGER_VIEW", "RECONCILE", "POT_ADJUST", "BILL_CREATE", "REFUND"],
  MANAGER: ["PAYOUT_REQUEST", "BILL_CREATE", "LEDGER_VIEW"],
  ACCOUNTANT: ["LEDGER_VIEW", "RECONCILE"],
  STAFF: [],
};

export type PotType = "GST" | "STAFF_SALARY" | "INVENTORY" | "MAINTENANCE" | "SUBSCRIPTIONS" | "SERVICE_CHARGES" | "OWNER_PROFIT" | "CUSTOM";
export interface Pot { id: string; businessId: string; type: PotType; name: string; status: "ACTIVE" | "ARCHIVED" }

export type Account = "FUNDS" | "UNALLOCATED" | "DISPUTE_HOLD" | `POT:${string}`;
export type LedgerSource = "PAYMENT_ALLOCATION" | "REFUND_REVERSAL" | "PAYOUT" | "DISPUTE_HOLD" | "DISPUTE_RELEASE" | "OWNER_ADJUSTMENT";

export interface LedgerEntry {
  readonly id: string; readonly businessId: string; readonly journalId: string;
  readonly account: Account;
  /** Signed paise. Positive = CREDIT to the account, negative = DEBIT. */
  readonly amount: Paise;
  readonly direction: "CREDIT" | "DEBIT";
  readonly sourceType: LedgerSource; readonly sourceId: string;
  readonly ruleKey?: string; readonly ruleVersion?: number;
  readonly actorId: string; readonly createdAt: Date; readonly reason?: string;
}
interface Leg { account: Account; amount: Paise; ruleKey?: string; ruleVersion?: number }

export interface AuditLog { id: string; businessId: string; actorId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown; at: Date }
export interface OwnerAlert { id: string; businessId: string; code: string; message: string; at: Date; data?: unknown }

export class InsufficientFundsError extends Error { constructor(public account: string, public shortfall: Paise) { super(`Insufficient funds in ${account}: short by ${shortfall} paise`); } }
export class PermissionError extends Error {}
export class StepUpRequiredError extends Error {}
export class RefundShortfallError extends Error { constructor(public shortfall: Paise) { super(`Refund cannot be reversed from ledger: short by ${shortfall} paise`); } }

export type PaymentStatus = "PENDING" | "FAILED" | "SUCCEEDED";
interface Component { account: Account; ruleKey?: string; ruleVersion?: number; original: Paise; reversed: Paise }
export interface PaymentRecord {
  businessId: string; paymentId: string; billId: string; amount: Paise; eligible: Paise;
  status: PaymentStatus; billPaid: boolean; succeededAt?: Date;
  allocation?: { lines: AllocationLine[]; unallocated: Paise };
  components: Component[]; refunded: Paise;
}
export interface PaymentEvent {
  businessId: string; eventId: string; paymentId: string; billId: string;
  status: "SUCCESS" | "PENDING" | "FAILED"; amount: Paise;
  /** Amount eligible for rule allocation (e.g. after tax-treatment config). Defaults to amount. */
  eligible?: Paise; at?: Date;
}
export type PaymentOutcome =
  | { outcome: "DUPLICATE_EVENT" } | { outcome: "ALREADY_ALLOCATED"; payment: PaymentRecord }
  | { outcome: "FAILED_RECORDED" | "PENDING_RECORDED"; payment: PaymentRecord }
  | { outcome: "ALLOCATED"; payment: PaymentRecord; alerts: AllocationAlert[]; markBillPaid: true };

export type PayoutStatus = "PENDING_APPROVAL" | "APPROVED" | "SUCCESS" | "FAILED" | "CANCELLED";
export interface Payout {
  id: string; businessId: string; potId: string; amount: Paise;
  /** Provider token / masked reference only. Never raw bank credentials. */
  recipientRef: string; requestedBy: string; status: PayoutStatus; highRisk: boolean;
  approvedBy?: string; approvedAt?: Date; providerRef?: string; simulated: true; createdAt: Date;
}
export interface ReconException { id: string; businessId: string; type: string; message: string; data?: unknown; at: Date }

export interface PotsOptions {
  clock?: () => Date;
  /** Payouts at/above this are high-risk (step-up required). Profit withdrawals are always high-risk. */
  highRiskPayoutThreshold?: Paise;
  requireSecondApproval?: boolean;
  /** Refunds at/above this need step-up (Pots spec §11 "refund/reversal above configured threshold"). Default 5,000.00. */
  highRiskRefundThreshold?: Paise;
  grants?: Partial<Record<Role, Action[]>>;
}

export const DEFAULT_POTS: { type: PotType; name: string }[] = [
  { type: "GST", name: "GST" }, { type: "STAFF_SALARY", name: "Staff Salary" }, { type: "INVENTORY", name: "Inventory" },
  { type: "MAINTENANCE", name: "Maintenance" }, { type: "SUBSCRIPTIONS", name: "Subscriptions" },
  { type: "SERVICE_CHARGES", name: "Service Charges" }, { type: "OWNER_PROFIT", name: "Owner Profit" },
];

const potAcct = (id: string): Account => `POT:${id}`;
const sameMonth = (a: Date, b: Date) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

export class PotsService {
  private entries: LedgerEntry[] = [];
  private journalKeys = new Set<string>();
  private seenEvents = new Set<string>();
  private seq = 0;
  readonly pots = new Map<string, Pot>();
  private rules: PotRule[] = [];
  private payments = new Map<string, PaymentRecord>();
  readonly attempts: PaymentEvent[] = [];
  private payouts = new Map<string, Payout>();
  private disputes = new Map<string, { businessId: string; paymentId: string; amount: Paise; legs: Leg[]; shares: Paise[]; status: "OPEN" | "WON" | "LOST" }>();
  readonly auditLogs: AuditLog[] = [];
  readonly alerts: OwnerAlert[] = [];
  readonly exceptions: ReconException[] = [];
  readonly settlements: { id: string; businessId: string; gross: Paise; fees: Paise; net: Paise; paymentIds: string[] }[] = [];
  private clock: () => Date;
  constructor(private opts: PotsOptions = {}) { this.clock = opts.clock ?? (() => new Date()); }

  private nid(p: string) { return `${p}_${++this.seq}`; }
  private can(role: Role, a: Action) { return BASE_PERMISSIONS[role].includes(a) || (this.opts.grants?.[role] ?? []).includes(a); }
  private need(role: Role, a: Action) { if (!this.can(role, a)) throw new PermissionError(`${role} cannot ${a}`); }
  private audit(businessId: string, actorId: string, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) {
    this.auditLogs.push({ id: this.nid("aud"), businessId, actorId, action, entity, entityId, before, after, at: this.clock() });
  }
  private alert(businessId: string, code: string, message: string, data?: unknown) {
    this.alerts.push({ id: this.nid("alert"), businessId, code, message, at: this.clock(), data });
  }

  // ---------- pots & rules ----------
  createDefaultPots(businessId: string): Pot[] {
    return DEFAULT_POTS.map((p) => this.createPot(businessId, p.type, p.name, `${businessId}:${p.type}`));
  }
  createPot(businessId: string, type: PotType, name: string, id = this.nid("pot")): Pot {
    const pot: Pot = { id, businessId, type, name, status: "ACTIVE" };
    this.pots.set(id, pot);
    return pot;
  }
  private getPot(businessId: string, potId: string): Pot {
    const p = this.pots.get(potId);
    if (!p || p.businessId !== businessId) throw new Error(`pot ${potId} not found for business`);
    return p;
  }
  /** Version 1 of a new rule. Rules are configuration, not ledger, but versions are never mutated. */
  createRule(r: Omit<PotRule, "version">, actorId: string, role: Role, stepUpVerified: boolean): PotRule {
    this.need(role, "RULES_CONFIGURE");
    if (!stepUpVerified) throw new StepUpRequiredError("changing allocation rules requires step-up authentication");
    this.getPot(r.businessId, r.potId);
    const rule: PotRule = Object.freeze({ ...r, version: 1 });
    this.rules.push(rule);
    this.audit(r.businessId, actorId, "RULE_CREATED", "pot_rule", rule.ruleKey, undefined, rule);
    this.alert(r.businessId, "RULE_CHANGED", `Rule ${rule.ruleKey} created`);
    return rule;
  }
  /** Close the current version at `effectiveFrom` and add version+1. Historical allocations keep their snapshot. */
  reviseRule(businessId: string, ruleKey: string, changes: Partial<Omit<PotRule, "ruleKey" | "version" | "businessId">>, actorId: string, role: Role, stepUpVerified: boolean, effectiveFrom = this.clock()): PotRule {
    this.need(role, "RULES_CONFIGURE");
    if (!stepUpVerified) throw new StepUpRequiredError("changing allocation rules requires step-up authentication");
    const versions = this.rules.filter((x) => x.businessId === businessId && x.ruleKey === ruleKey);
    if (!versions.length) throw new Error(`rule ${ruleKey} not found`);
    const cur = versions.reduce((a, b) => (b.version > a.version ? b : a));
    const next: PotRule = Object.freeze({ ...cur, ...changes, version: cur.version + 1, effectiveFrom, effectiveTo: changes.effectiveTo ?? null });
    this.rules[this.rules.indexOf(cur)] = Object.freeze({ ...cur, effectiveTo: effectiveFrom });
    this.rules.push(next);
    this.audit(businessId, actorId, "RULE_REVISED", "pot_rule", ruleKey, cur, next);
    this.alert(businessId, "RULE_CHANGED", `Rule ${ruleKey} now v${next.version}`);
    return next;
  }
  listRules(businessId: string): PotRule[] { return this.rules.filter((r) => r.businessId === businessId); }

  // ---------- ledger core ----------
  private balance(businessId: string, account: Account): Paise {
    let s = 0;
    for (const e of this.entries) if (e.businessId === businessId && e.account === account) s += e.amount;
    return s;
  }
  getPotBalance(businessId: string, potId: string): Paise { return this.balance(businessId, potAcct(potId)); }
  getUnallocated(businessId: string): Paise { return this.balance(businessId, "UNALLOCATED"); }
  getEntries(businessId: string, account?: Account): readonly LedgerEntry[] {
    return this.entries.filter((e) => e.businessId === businessId && (!account || e.account === account));
  }

  /** Returns false if the idempotency key already exists (nothing written). */
  private post(businessId: string, key: string, sourceType: LedgerSource, sourceId: string, legs: Leg[], actorId: string, reason?: string): boolean {
    const k = `${businessId}:${key}`;
    if (this.journalKeys.has(k)) return false;
    const live = legs.filter((l) => l.amount !== 0);
    live.forEach((l) => assertPaise(l.amount, "leg"));
    if (live.reduce((a, l) => a + l.amount, 0) !== 0) throw new Error("journal does not balance");
    const delta = new Map<Account, number>();
    for (const l of live) delta.set(l.account, (delta.get(l.account) ?? 0) + l.amount);
    for (const [acct, d] of delta) {
      if (acct === "FUNDS") continue;
      const after = this.balance(businessId, acct) + d;
      if (after < 0) throw new InsufficientFundsError(acct, -after);
    }
    const journalId = this.nid("jrn"); const createdAt = this.clock();
    for (const l of live) {
      this.entries.push(Object.freeze({
        id: this.nid("le"), businessId, journalId, account: l.account, amount: l.amount,
        direction: l.amount > 0 ? "CREDIT" : "DEBIT", sourceType, sourceId,
        ruleKey: l.ruleKey, ruleVersion: l.ruleVersion, actorId, createdAt, reason,
      }));
    }
    this.journalKeys.add(k);
    return true;
  }

  // ---------- payments ----------
  getPayment(businessId: string, paymentId: string) { return this.payments.get(`${businessId}:${paymentId}`); }

  handlePaymentEvent(ev: PaymentEvent): PaymentOutcome {
    assertPositivePaise(ev.amount, "payment amount");
    const eligible = ev.eligible ?? ev.amount;
    assertPaise(eligible, "eligible");
    if (eligible < 0 || eligible > ev.amount) throw new Error("eligible must be within 0..amount");
    const evKey = `${ev.businessId}:${ev.eventId}`;
    if (this.seenEvents.has(evKey)) return { outcome: "DUPLICATE_EVENT" };
    this.seenEvents.add(evKey);
    this.attempts.push(Object.freeze({ ...ev })); // every attempt retained for audit

    const pk = `${ev.businessId}:${ev.paymentId}`;
    const existing = this.payments.get(pk);
    if (existing?.status === "SUCCEEDED") return { outcome: "ALREADY_ALLOCATED", payment: existing };

    const base: PaymentRecord = existing ?? {
      businessId: ev.businessId, paymentId: ev.paymentId, billId: ev.billId, amount: ev.amount, eligible,
      status: "PENDING", billPaid: false, components: [], refunded: 0,
    };
    if (ev.status !== "SUCCESS") {
      base.status = ev.status === "FAILED" ? "FAILED" : "PENDING";
      this.payments.set(pk, base);
      if (ev.status === "FAILED") this.alert(ev.businessId, "PAYMENT_FAILED", `Payment ${ev.paymentId} failed`);
      return { outcome: ev.status === "FAILED" ? "FAILED_RECORDED" : "PENDING_RECORDED", payment: base };
    }

    const at = ev.at ?? this.clock();
    const mtd: Record<string, Paise> = {};
    for (const e of this.entries) {
      if (e.businessId === ev.businessId && e.account.startsWith("POT:") && (e.sourceType === "PAYMENT_ALLOCATION" || e.sourceType === "REFUND_REVERSAL") && sameMonth(e.createdAt, at)) {
        const id = e.account.slice(4); mtd[id] = (mtd[id] ?? 0) + e.amount;
      }
    }
    const res = allocate({ eligible, rules: this.rules.filter((r) => r.businessId === ev.businessId && this.pots.has(r.potId)), at, monthToDateByPot: mtd });
    const unalloc = ev.amount - res.allocated; // non-eligible part + engine remainder: tracked, never lost
    const legs: Leg[] = [{ account: "FUNDS", amount: -ev.amount }];
    for (const l of res.lines) legs.push({ account: potAcct(l.potId), amount: l.amount, ruleKey: l.ruleKey, ruleVersion: l.ruleVersion });
    if (unalloc > 0) legs.push({ account: "UNALLOCATED", amount: unalloc });
    this.post(ev.businessId, `alloc:${ev.paymentId}`, "PAYMENT_ALLOCATION", ev.paymentId, legs, "system");

    base.status = "SUCCEEDED"; base.billPaid = true; base.succeededAt = at; base.eligible = eligible; base.amount = ev.amount;
    base.allocation = { lines: res.lines, unallocated: unalloc };
    base.components = [
      ...res.lines.map((l) => ({ account: potAcct(l.potId), ruleKey: l.ruleKey, ruleVersion: l.ruleVersion, original: l.amount, reversed: 0 })),
      ...(unalloc > 0 ? [{ account: "UNALLOCATED" as Account, original: unalloc, reversed: 0 }] : []),
    ];
    this.payments.set(pk, base);
    this.audit(ev.businessId, "system", "PAYMENT_ALLOCATED", "payment", ev.paymentId, undefined, base.allocation);
    for (const a of res.alerts) if (a.code !== "UNALLOCATED_REMAINDER" || unalloc > 0) this.alert(ev.businessId, a.code, a.message, a);
    return { outcome: "ALLOCATED", payment: base, alerts: res.alerts, markBillPaid: true };
  }

  // ---------- refunds & disputes ----------
  /** Debit components pro-rata; pots short of balance are covered from UNALLOCATED, else the op is blocked. */
  private reverse(payment: PaymentRecord, R: Paise, dest: Account, key: string, sourceType: LedgerSource, sourceId: string, actorId: string, reason?: string) {
    const biz = payment.businessId;
    const weights = payment.components.map((c) => c.original - c.reversed);
    if (R > weights.reduce((a, b) => a + b, 0)) throw new Error("amount exceeds remaining allocated value");
    const shares = apportion(R, weights);
    const tmp = new Map<Account, number>();
    const bal = (a: Account) => tmp.get(a) ?? this.balance(biz, a);
    const legs: Leg[] = []; let shortfall = 0;
    payment.components.forEach((c, i) => {
      const want = shares[i]!; const take = Math.min(want, bal(c.account));
      shortfall += want - take;
      if (take > 0) { legs.push({ account: c.account, amount: -take, ruleKey: c.ruleKey, ruleVersion: c.ruleVersion }); tmp.set(c.account, bal(c.account) - take); }
    });
    if (shortfall > 0) {
      if (bal("UNALLOCATED") < shortfall) {
        this.exceptions.push({ id: this.nid("exc"), businessId: biz, type: "REFUND_SHORTFALL", message: `Cannot reverse ${R}; short ${shortfall - bal("UNALLOCATED")}`, at: this.clock(), data: { sourceId } });
        this.alert(biz, "REFUND_SHORTFALL", `Refund ${sourceId} cannot be covered from Pot/unallocated funds`);
        throw new RefundShortfallError(shortfall - bal("UNALLOCATED"));
      }
      legs.push({ account: "UNALLOCATED", amount: -shortfall });
      this.alert(biz, "REFUND_COVERED_FROM_UNALLOCATED", `${shortfall} paise of ${sourceId} covered from unallocated funds`);
    }
    legs.push({ account: dest, amount: R });
    const wrote = this.post(biz, key, sourceType, sourceId, legs, actorId, reason);
    if (!wrote) return null;
    payment.components.forEach((c, i) => (c.reversed += shares[i]!));
    return { legs, shares };
  }

  refundPayment(i: { businessId: string; refundId: string; paymentId: string; amount: Paise; actorId: string; role: Role; reason: string; stepUpVerified?: boolean }) {
    this.need(i.role, "REFUND");
    assertPositivePaise(i.amount, "refund");
    if (i.amount >= (this.opts.highRiskRefundThreshold ?? 500_000) && !i.stepUpVerified) throw new StepUpRequiredError("large refund requires step-up authentication");
    const p = this.getPayment(i.businessId, i.paymentId);
    if (!p || p.status !== "SUCCEEDED") throw new Error("only a successful payment can be refunded");
    if (this.journalKeys.has(`${i.businessId}:refund:${i.refundId}`)) return { duplicate: true as const };
    if (p.refunded + i.amount > p.amount) throw new Error("refund exceeds payment amount");
    const r = this.reverse(p, i.amount, "FUNDS", `refund:${i.refundId}`, "REFUND_REVERSAL", i.refundId, i.actorId, i.reason);
    if (!r) return { duplicate: true as const };
    p.refunded += i.amount;
    this.audit(i.businessId, i.actorId, "REFUND_REVERSED", "payment", i.paymentId, undefined, { refundId: i.refundId, amount: i.amount, reason: i.reason });
    return { duplicate: false as const, payment: p };
  }

  openDispute(i: { businessId: string; disputeId: string; paymentId: string; amount?: Paise; actorId: string }) {
    const p = this.getPayment(i.businessId, i.paymentId);
    if (!p || p.status !== "SUCCEEDED") throw new Error("dispute requires a successful payment");
    const amount = i.amount ?? p.amount - p.refunded;
    if (this.disputes.has(i.disputeId)) return { duplicate: true as const };
    const r = this.reverse(p, amount, "DISPUTE_HOLD", `dispute:${i.disputeId}`, "DISPUTE_HOLD", i.disputeId, i.actorId, "chargeback/dispute freeze");
    if (!r) return { duplicate: true as const };
    p.refunded += amount;
    this.disputes.set(i.disputeId, { businessId: i.businessId, paymentId: i.paymentId, amount, legs: r.legs, shares: r.shares, status: "OPEN" });
    this.exceptions.push({ id: this.nid("exc"), businessId: i.businessId, type: "CHARGEBACK", message: `Dispute ${i.disputeId} opened for ${amount} paise`, at: this.clock() });
    this.alert(i.businessId, "CHARGEBACK_OPENED", `Dispute ${i.disputeId}: ${amount} paise frozen`);
    this.audit(i.businessId, i.actorId, "DISPUTE_OPENED", "payment", i.paymentId, undefined, { disputeId: i.disputeId, amount });
    return { duplicate: false as const };
  }
  resolveDispute(businessId: string, disputeId: string, outcome: "WON" | "LOST", actorId: string) {
    const d = this.disputes.get(disputeId);
    if (!d || d.businessId !== businessId) throw new Error("dispute not found");
    if (d.status !== "OPEN") return { duplicate: true as const };
    const p = this.getPayment(businessId, d.paymentId)!;
    if (outcome === "LOST") {
      this.post(businessId, `dispute-release:${disputeId}`, "DISPUTE_RELEASE", disputeId, [{ account: "DISPUTE_HOLD", amount: -d.amount }, { account: "FUNDS", amount: d.amount }], actorId, "dispute lost");
    } else {
      this.post(businessId, `dispute-release:${disputeId}`, "DISPUTE_RELEASE", disputeId, d.legs.map((l) => ({ ...l, amount: -l.amount })), actorId, "dispute won: hold returned");
      p.components.forEach((c, i) => (c.reversed -= d.shares[i]!));
      p.refunded -= d.amount;
    }
    d.status = outcome;
    this.audit(businessId, actorId, `DISPUTE_${outcome}`, "payment", d.paymentId, undefined, { disputeId });
    return { duplicate: false as const };
  }

  recordSettlement(s: { id: string; businessId: string; gross: Paise; fees: Paise; net: Paise; paymentIds: string[] }) {
    const sum = s.paymentIds.reduce((a, id) => a + (this.getPayment(s.businessId, id)?.amount ?? 0), 0);
    if (s.gross - s.fees !== s.net || s.gross !== sum) {
      this.exceptions.push({ id: this.nid("exc"), businessId: s.businessId, type: "SETTLEMENT_MISMATCH", message: `Settlement ${s.id} does not reconcile`, at: this.clock(), data: { ...s, paymentsTotal: sum } });
      this.alert(s.businessId, "SETTLEMENT_MISMATCH", `Settlement ${s.id} mismatch`); // balances deliberately untouched
    }
    this.settlements.push(s);
  }

  // ---------- manual owner override ----------
  ownerAdjust(i: { businessId: string; adjustmentId: string; from: "UNALLOCATED" | { potId: string }; to: "UNALLOCATED" | { potId: string }; amount: Paise; reason: string; actorId: string; role: Role; stepUpVerified: boolean }) {
    this.need(i.role, "POT_ADJUST");
    if (!i.stepUpVerified) throw new StepUpRequiredError("manual override requires step-up");
    if (!i.reason.trim()) throw new Error("reason required");
    assertPositivePaise(i.amount);
    const acct = (x: "UNALLOCATED" | { potId: string }): Account => (x === "UNALLOCATED" ? "UNALLOCATED" : (this.getPot(i.businessId, x.potId), potAcct(x.potId)));
    const wrote = this.post(i.businessId, `adjust:${i.adjustmentId}`, "OWNER_ADJUSTMENT", i.adjustmentId, [{ account: acct(i.from), amount: -i.amount }, { account: acct(i.to), amount: i.amount }], i.actorId, i.reason);
    if (wrote) this.audit(i.businessId, i.actorId, "OWNER_ADJUSTMENT", "pot", i.adjustmentId, undefined, { from: i.from, to: i.to, amount: i.amount, reason: i.reason });
    return { duplicate: !wrote };
  }

  // ---------- payouts (SIMULATED provider) ----------
  private reserved(businessId: string, potId: string): Paise {
    let s = 0;
    for (const p of this.payouts.values()) if (p.businessId === businessId && p.potId === potId && (p.status === "PENDING_APPROVAL" || p.status === "APPROVED")) s += p.amount;
    return s;
  }
  getAvailable(businessId: string, potId: string): Paise { return this.getPotBalance(businessId, potId) - this.reserved(businessId, potId); }
  getPayout(id: string) { return this.payouts.get(id); }

  requestPayout(i: { businessId: string; payoutId: string; potId: string; amount: Paise; recipientRef: string; actorId: string; role: Role }): Payout {
    const ex = this.payouts.get(i.payoutId); if (ex) return ex; // idempotent
    const pot = this.getPot(i.businessId, i.potId);
    assertPositivePaise(i.amount, "payout");
    this.need(i.role, pot.type === "OWNER_PROFIT" ? "PROFIT_WITHDRAW" : "PAYOUT_REQUEST");
    const avail = this.getAvailable(i.businessId, i.potId);
    if (i.amount > avail) throw new InsufficientFundsError(`POT:${i.potId}`, i.amount - avail);
    const threshold = this.opts.highRiskPayoutThreshold ?? 5_000_000;
    const p: Payout = {
      id: i.payoutId, businessId: i.businessId, potId: i.potId, amount: i.amount, recipientRef: i.recipientRef,
      requestedBy: i.actorId, status: "PENDING_APPROVAL", highRisk: pot.type === "OWNER_PROFIT" || i.amount >= threshold,
      simulated: true, createdAt: this.clock(),
    };
    this.payouts.set(p.id, p);
    this.audit(i.businessId, i.actorId, "PAYOUT_REQUESTED", "payout", p.id, undefined, { ...p });
    if (p.highRisk) this.alert(i.businessId, "APPROVAL_PENDING", `High-risk payout ${p.id} awaiting approval`);
    return p;
  }
  approvePayout(i: { payoutId: string; actorId: string; role: Role; stepUpVerified: boolean }): Payout {
    const p = this.mustPayout(i.payoutId);
    this.need(i.role, "PAYOUT_APPROVE");
    if (p.status !== "PENDING_APPROVAL") return p;
    if (p.highRisk && !i.stepUpVerified) throw new StepUpRequiredError("step-up authentication required");
    if (this.opts.requireSecondApproval && i.actorId === p.requestedBy) throw new PermissionError("maker-checker: approver must differ from requester");
    p.status = "APPROVED"; p.approvedBy = i.actorId; p.approvedAt = this.clock();
    this.audit(p.businessId, i.actorId, "PAYOUT_APPROVED", "payout", p.id, undefined, { ...p });
    return p;
  }
  cancelPayout(payoutId: string, actorId: string, role: Role) {
    const p = this.mustPayout(payoutId);
    if (!(this.can(role, "PAYOUT_APPROVE") || (this.can(role, "PAYOUT_REQUEST") && actorId === p.requestedBy))) throw new PermissionError(`${role} cannot cancel this payout`);
    if (p.status === "PENDING_APPROVAL" || p.status === "APPROVED") { p.status = "CANCELLED"; this.audit(p.businessId, actorId, "PAYOUT_CANCELLED", "payout", p.id); }
    return p;
  }
  /** providerResult comes from the (simulated) provider integration layer. */
  executePayout(payoutId: string, providerResult: { status: "SUCCESS" | "FAILED"; providerRef: string }): Payout {
    const p = this.mustPayout(payoutId);
    if (p.status === "SUCCESS" || p.status === "FAILED") return p; // idempotent
    if (p.status !== "APPROVED") throw new PermissionError("payout must be approved before execution");
    p.providerRef = providerResult.providerRef;
    if (providerResult.status === "SUCCESS") {
      this.post(p.businessId, `payout:${p.id}`, "PAYOUT", p.id, [{ account: potAcct(p.potId), amount: -p.amount }, { account: "FUNDS", amount: p.amount }], "system");
      p.status = "SUCCESS";
    } else {
      p.status = "FAILED"; // no ledger movement: Pot is not permanently reduced
      this.alert(p.businessId, "PAYOUT_FAILED", `Payout ${p.id} failed`);
    }
    this.audit(p.businessId, "system", `PAYOUT_${p.status}`, "payout", p.id, undefined, { providerRef: p.providerRef });
    return p;
  }
  private mustPayout(id: string) { const p = this.payouts.get(id); if (!p) throw new Error("payout not found"); return p; }

  // ---------- reconciliation & views ----------
  reconcile(businessId: string) {
    const pots = [...this.pots.values()].filter((p) => p.businessId === businessId).reduce((a, p) => a + this.getPotBalance(businessId, p.id), 0);
    const unallocated = this.getUnallocated(businessId);
    const hold = this.balance(businessId, "DISPUTE_HOLD");
    const fundsRepresented = 0 - this.balance(businessId, "FUNDS"); // 0 - x avoids -0
    const byJournal = new Map<string, number>();
    for (const e of this.entries) if (e.businessId === businessId) byJournal.set(e.journalId, (byJournal.get(e.journalId) ?? 0) + e.amount);
    const journalsBalanced = [...byJournal.values()].every((v) => v === 0);
    const diff = fundsRepresented - (pots + unallocated + hold);
    return { ok: diff === 0 && journalsBalanced, fundsRepresented, pots, unallocated, disputeHold: hold, diff, journalsBalanced };
  }

  getDashboard(businessId: string, now = this.clock()) {
    const rec = this.reconcile(businessId);
    let todaysSales = 0;
    for (const p of this.payments.values()) if (p.businessId === businessId && p.status === "SUCCEEDED" && p.succeededAt && p.succeededAt.toDateString() === now.toDateString()) todaysSales += p.amount;
    return { totalSettledBalance: rec.fundsRepresented, todaysSales, allocatedToPots: rec.pots, unallocated: rec.unallocated, disputeHold: rec.disputeHold, reconciled: rec.ok, simulated: true as const };
  }

  getPotView(businessId: string, potId: string, now = this.clock()) {
    const pot = this.getPot(businessId, potId);
    const balance = this.getPotBalance(businessId, potId);
    const rules = activeRules(this.listRules(businessId).filter((r) => r.potId === potId), now);
    const target = rules.find((r) => r.method === "MONTHLY_TARGET");
    let mtd = 0;
    for (const e of this.entries) if (e.businessId === businessId && e.account === potAcct(potId) && (e.sourceType === "PAYMENT_ALLOCATION" || e.sourceType === "REFUND_REVERSAL") && sameMonth(e.createdAt, now)) mtd += e.amount;
    let running = 0;
    const transactions = this.getEntries(businessId, potAcct(potId)).map((e) => ({ ...e, balanceAfter: (running += e.amount) }));
    return {
      pot, balance, reserved: this.reserved(businessId, potId), available: this.getAvailable(businessId, potId),
      target: target?.value, progressPercent: target && target.value > 0 ? Math.min(100, Math.floor((mtd * 100) / target.value)) : undefined,
      activeRules: rules, transactions,
    };
  }
}

export type { RuleMethod };
