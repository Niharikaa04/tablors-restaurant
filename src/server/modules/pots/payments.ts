import { apportion, assertPaise, assertPositivePaise, type Paise } from "./money";
import { allocate, selectActiveRules, type AllocationAlert, type AllocationLine, type AllocationRule } from "./rules";
import { potAccount, type Account, type Leg, type Ledger } from "./ledger";
import type { AlertCenter, AuditLog } from "./support";

/**
 * Payment -> Pots allocation and refund reversal on top of the Ledger.
 *
 * ALL payment provider behaviour here is SIMULATED (prototype mode): events come
 * from the in-memory demo store, never from a real PSP. No card/UPI/bank secrets
 * are accepted or stored. Allocation itself is the pure `allocate` engine fed
 * with owner-published rules only; with no rules, everything is UNALLOCATED.
 */
export type PaymentStatus = "PENDING" | "FAILED" | "SUCCESS";

interface Component {
  account: Account;
  ruleId?: string;
  ruleVersion?: number;
  original: Paise;
  reversed: Paise;
}

export interface PaymentRecord {
  businessId: string;
  providerRef: string;
  billId: string;
  amount: Paise;
  eligible: Paise;
  status: PaymentStatus;
  simulated: true;
  succeededAt?: Date;
  allocation?: { lines: AllocationLine[]; unallocated: Paise };
  components: Component[];
  refunded: Paise;
}

export interface PaymentEvent {
  /** Provider event id: the same event delivered twice is processed once. */
  providerEventId: string;
  /** Provider payment reference: one ledger payment per ref. */
  providerRef: string;
  businessId: string;
  billId: string;
  amount: Paise;
  status: "SUCCESS" | "PENDING" | "FAILED";
  /** Amount eligible for rule allocation (e.g. after tax treatment). Defaults to amount. */
  eligible?: Paise;
  at?: Date;
}

export type PaymentOutcome =
  | { outcome: "DUPLICATE_EVENT" }
  | { outcome: "ALREADY_ALLOCATED"; payment: PaymentRecord }
  | { outcome: "FAILED_RECORDED" | "PENDING_RECORDED"; payment: PaymentRecord }
  | { outcome: "ALLOCATED"; payment: PaymentRecord; alerts: AllocationAlert[] };

export interface RefundInput {
  refundId: string;
  providerRef: string;
  amount: Paise;
  actorId: string;
  at?: Date;
  reason: string;
  /** Result of an external step-up check (PIN/OTP). Required for refunds at/above the threshold. */
  stepUpVerified?: boolean;
}
export interface Shortfall { account: string; shortfall: Paise }
export type RefundResult =
  | { status: "APPLIED"; payment: PaymentRecord }
  | { status: "DUPLICATE" }
  | { status: "STEP_UP_REQUIRED"; threshold: Paise }
  | { status: "BLOCKED"; shortfall: Paise; shortfalls: Shortfall[] };

export interface ReconException { id: string; businessId: string; code: string; detail: string; at: Date }

export interface PaymentServiceDeps {
  ledger: Ledger;
  audit: AuditLog;
  alerts: AlertCenter;
  potIds: () => readonly string[];
  getRules: (businessId: string) => readonly AllocationRule[];
  clock?: () => Date;
  /** Refunds at/above this need step-up (Pots spec §11). Default ₹5,000.00. */
  highRiskRefundThreshold?: Paise;
}

const SYSTEM = "system";

export class PaymentService {
  readonly exceptions: ReconException[] = [];
  /** Every received event is retained for audit. */
  readonly attempts: PaymentEvent[] = [];
  private payments = new Map<string, PaymentRecord>();
  private seenEvents = new Set<string>();
  private seq = 0;
  private clock: () => Date;

  constructor(private deps: PaymentServiceDeps) {
    this.clock = deps.clock ?? (() => new Date());
  }

  getPayment(providerRef: string, businessId?: string): PaymentRecord | undefined {
    if (businessId !== undefined) return this.payments.get(`${businessId}:${providerRef}`);
    for (const p of this.payments.values()) if (p.providerRef === providerRef) return p;
    return undefined;
  }

  handleEvent(ev: PaymentEvent): PaymentOutcome {
    const { ledger, audit, alerts } = this.deps;
    assertPositivePaise(ev.amount, "payment amount");
    const eligible = ev.eligible ?? ev.amount;
    assertPaise(eligible, "eligible");
    if (eligible < 0 || eligible > ev.amount) throw new Error("eligible must be within 0..amount");

    const evKey = `${ev.businessId}:${ev.providerEventId}`;
    if (this.seenEvents.has(evKey)) return { outcome: "DUPLICATE_EVENT" };
    this.seenEvents.add(evKey);
    this.attempts.push(Object.freeze({ ...ev }));

    const pk = `${ev.businessId}:${ev.providerRef}`;
    const existing = this.payments.get(pk);
    if (existing?.status === "SUCCESS") return { outcome: "ALREADY_ALLOCATED", payment: existing };

    const base: PaymentRecord = existing ?? {
      businessId: ev.businessId, providerRef: ev.providerRef, billId: ev.billId, amount: ev.amount, eligible,
      status: "PENDING", simulated: true, components: [], refunded: 0,
    };
    const at = ev.at ?? this.clock();

    if (ev.status !== "SUCCESS") {
      base.status = ev.status === "FAILED" ? "FAILED" : "PENDING";
      this.payments.set(pk, base);
      if (ev.status === "FAILED") alerts.raise(ev.businessId, "PAYMENT_FAILED", `Payment ${ev.providerRef} failed`, at);
      return { outcome: ev.status === "FAILED" ? "FAILED_RECORDED" : "PENDING_RECORDED", payment: base };
    }

    // Month-to-date per pot (UTC month of the payment: same window views.ts uses) for MONTHLY_TARGET.
    const mFrom = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
    const mTo = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
    const potIds = this.deps.potIds();
    const monthToDateByPot: Record<string, Paise> = {};
    for (const id of potIds) monthToDateByPot[id] = ledger.allocatedToPot(ev.businessId, id, mFrom, mTo);

    const known = new Set(potIds);
    const rules = selectActiveRules(this.deps.getRules(ev.businessId), ev.businessId, at).filter((r) => known.has(r.potId));
    const res = allocate({ eligible, rules, at, monthToDateByPot });
    const unalloc = ev.amount - res.allocated; // non-eligible part + engine remainder: tracked, never lost

    const ruleIdOf = new Map(rules.map((r) => [`${r.ruleKey}:${r.version}`, r.id]));
    const legs: Leg[] = [{ account: "SETTLEMENT", amount: -ev.amount, sourceType: "PAYMENT_RECEIVED" }];
    for (const l of res.lines) {
      legs.push({ account: potAccount(l.potId), amount: l.amount, sourceType: "ALLOCATION", ruleId: ruleIdOf.get(`${l.ruleKey}:${l.ruleVersion}`), ruleVersion: l.ruleVersion });
    }
    if (unalloc > 0) legs.push({ account: "UNALLOCATED", amount: unalloc, sourceType: "ALLOCATION" });
    ledger.post(ev.businessId, `alloc:${ev.providerRef}`, ev.providerRef, legs, SYSTEM, at);

    base.status = "SUCCESS"; base.succeededAt = at; base.eligible = eligible; base.amount = ev.amount;
    base.allocation = { lines: res.lines, unallocated: unalloc };
    base.components = [
      ...res.lines.map((l): Component => ({ account: potAccount(l.potId), ruleId: ruleIdOf.get(`${l.ruleKey}:${l.ruleVersion}`), ruleVersion: l.ruleVersion, original: l.amount, reversed: 0 })),
      ...(unalloc > 0 ? [{ account: "UNALLOCATED" as Account, original: unalloc, reversed: 0 }] : []),
    ];
    this.payments.set(pk, base);
    audit.record({ businessId: ev.businessId, actorId: SYSTEM, action: "PAYMENT_ALLOCATED", entity: "payment", entityId: ev.providerRef, after: base.allocation, at });
    for (const a of res.alerts) alerts.raise(ev.businessId, a.code, a.message, at, a);
    return { outcome: "ALLOCATED", payment: base, alerts: res.alerts };
  }

  /**
   * Reverses a refund pro-rata across the components the payment was allocated to.
   * A pot short of balance is covered from UNALLOCATED; if that is not enough either,
   * NOTHING is written: the refund is BLOCKED and surfaced as an alert + exception.
   * Replaying the same refundId is a no-op (DUPLICATE).
   */
  refund(i: RefundInput): RefundResult {
    const { ledger, audit, alerts } = this.deps;
    assertPositivePaise(i.amount, "refund");
    const payment = this.getPayment(i.providerRef);
    if (!payment || payment.status !== "SUCCESS") throw new Error("only a successful, allocated payment can be refunded");
    const biz = payment.businessId;
    const at = i.at ?? this.clock();
    const key = `refund:${i.refundId}`;
    if (ledger.hasJournal(biz, key)) return { status: "DUPLICATE" };
    const threshold = this.deps.highRiskRefundThreshold ?? 500_000;
    if (i.amount >= threshold && !i.stepUpVerified) {
      // Nothing is written; the owner is told and can retry with step-up. Never silent.
      alerts.raise(biz, "HIGH_RISK_ACTION_PENDING", `Refund ${i.refundId} of ${i.amount} paise needs step-up authentication`, at, { refundId: i.refundId });
      return { status: "STEP_UP_REQUIRED", threshold };
    }
    if (i.amount > payment.amount - payment.refunded) throw new Error("refund exceeds remaining payment amount");

    const weights = payment.components.map((c) => c.original - c.reversed);
    if (i.amount > weights.reduce((a, b) => a + b, 0)) throw new Error("refund exceeds remaining allocated value");
    const shares = apportion(i.amount, weights);

    const left = new Map<Account, Paise>();
    const bal = (a: Account): Paise => left.get(a) ?? ledger.balance(biz, a);
    const legs: Leg[] = [];
    let shortfall = 0;
    const shortfalls: Shortfall[] = [];
    payment.components.forEach((c, idx) => {
      const want = shares[idx] ?? 0;
      const take = Math.min(want, bal(c.account));
      if (want > take) { shortfall += want - take; shortfalls.push({ account: c.account, shortfall: want - take }); }
      if (take > 0) {
        legs.push({ account: c.account, amount: -take, sourceType: "ALLOCATION_REVERSAL", ruleId: c.ruleId, ruleVersion: c.ruleVersion });
        left.set(c.account, bal(c.account) - take);
      }
    });

    if (shortfall > 0) {
      const cover = bal("UNALLOCATED");
      if (cover < shortfall) {
        const detail = `Refund ${i.refundId} cannot be reversed: short ${shortfall - cover} paise after using unallocated funds`;
        this.exceptions.push({ id: `exc_${++this.seq}`, businessId: biz, code: "REFUND_SHORTFALL", detail, at });
        alerts.raise(biz, "REFUND_SHORTFALL", detail, at, { refundId: i.refundId, shortfalls });
        return { status: "BLOCKED", shortfall: shortfall - cover, shortfalls };
      }
      legs.push({ account: "UNALLOCATED", amount: -shortfall, sourceType: "ALLOCATION_REVERSAL" });
      alerts.raise(biz, "REFUND_COVERED_FROM_UNALLOCATED", `${shortfall} paise of refund ${i.refundId} covered from unallocated funds`, at);
    }
    legs.push({ account: "SETTLEMENT", amount: i.amount, sourceType: "REFUND_PAYOUT" });

    if (!ledger.post(biz, key, i.refundId, legs, i.actorId, at, i.reason)) return { status: "DUPLICATE" };
    payment.components.forEach((c, idx) => { c.reversed += shares[idx] ?? 0; });
    payment.refunded += i.amount;
    audit.record({ businessId: biz, actorId: i.actorId, action: "REFUND_REVERSED", entity: "payment", entityId: i.providerRef, reason: i.reason, after: { refundId: i.refundId, amount: i.amount }, at });
    return { status: "APPLIED", payment };
  }
}
