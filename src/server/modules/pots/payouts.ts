import { assertPositivePaise, type Paise } from "./money";
import { InsufficientFundsError, potAccount, type Ledger } from "./ledger";
import { can, type Action, type Grants } from "./permissions";
import { maskRef } from "./payroll";
import { PermissionError, StepUpRequiredError, type ActorRole, type AlertCenter, type AuditLog } from "./support";

/**
 * Payouts, supplier payments, profit withdrawals, tax transfers and manual Pot movements, all on the
 * single Pots Ledger (Pots spec §9-§12, acceptance 7-9, 12).
 *
 * Lifecycle: request -> (approval, step-up if high-risk, maker-checker if enabled) -> execute via the
 * provider integration layer -> ledger posts ONLY on provider SUCCESS. A failed payout never reduces a Pot.
 * Money held for pending/approved payouts is "reserved" and cannot be spent twice.
 * Provider behaviour is SIMULATED (prototype). Recipients are provider tokens/references, shown masked.
 */
export type PayoutKind = "SALARY" | "SUPPLIER" | "PROFIT" | "TAX" | "TRANSFER";
export type PayoutStatus = "PENDING_APPROVAL" | "APPROVED" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface Payout {
  id: string; businessId: string; potId: string; kind: PayoutKind; amount: Paise; fee: Paise;
  recipientRef: string; maskedRef: string; invoiceRef?: string; vendorId?: string; note?: string;
  requestedBy: string; status: PayoutStatus; highRisk: boolean;
  approvedBy?: string; approvedAt?: Date; providerRef?: string; failureReason?: string;
  simulated: true; createdAt: Date;
}
export interface PayoutRequest {
  businessId: string; payoutId: string; potId: string; amount: Paise; recipientRef: string; actorId: string; role: ActorRole;
  kind?: PayoutKind; invoiceRef?: string; vendorId?: string; note?: string; at?: Date;
}
export interface PayoutOptions {
  clock?: () => Date;
  /** Payouts at/above this need step-up (default ₹50,000). Profit withdrawals are always high-risk. */
  highRiskThreshold?: Paise;
  /** Hard per-transaction cap (default ₹10,00,000) and per-day cap across the business (default ₹25,00,000). */
  perTransactionLimit?: Paise; dailyLimit?: Paise;
  /** Requester and approver must be different people. */
  requireSecondApproval?: boolean;
  grants?: Grants;
}
export interface PayoutDeps { ledger: Ledger; audit: AuditLog; alerts: AlertCenter; potIds: () => readonly string[] }
export class PayoutLimitError extends Error {}

export const simulatedProvider = (payoutId: string, outcome: "SUCCESS" | "FAILED" = "SUCCESS") => ({ status: outcome, providerRef: `sim_${payoutId}` }) as const;
const IST = 330 * 60 * 1000;
const istDay = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);

export class PayoutService {
  private payouts = new Map<string, Payout>();
  private clock: () => Date;
  constructor(private deps: PayoutDeps, private opts: PayoutOptions = {}) { this.clock = opts.clock ?? (() => new Date()); }

  get limits() {
    return {
      highRiskThreshold: this.opts.highRiskThreshold ?? 5_000_000, perTransactionLimit: this.opts.perTransactionLimit ?? 100_000_000,
      dailyLimit: this.opts.dailyLimit ?? 250_000_000, requireSecondApproval: !!this.opts.requireSecondApproval,
    };
  }
  get grants(): Grants { return this.opts.grants ?? {}; }
  private need(role: ActorRole, a: Action) { if (!can(role, a, this.opts.grants)) throw new PermissionError(`${role} cannot ${a}`); }

  // ---------- reads ----------
  get(id: string) { return this.payouts.get(id); }
  list(businessId: string, kind?: PayoutKind): Payout[] {
    return [...this.payouts.values()].filter((p) => p.businessId === businessId && (!kind || p.kind === kind)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  pending(businessId: string): Payout[] { return this.list(businessId).filter((p) => p.status === "PENDING_APPROVAL" || p.status === "APPROVED"); }
  reserved(businessId: string, potId: string): Paise {
    let s = 0; for (const p of this.payouts.values()) if (p.businessId === businessId && p.potId === potId && (p.status === "PENDING_APPROVAL" || p.status === "APPROVED")) s += p.amount; return s;
  }
  getAvailable(businessId: string, potId: string): Paise { return this.deps.ledger.potBalance(businessId, potId) - this.reserved(businessId, potId); }

  // ---------- payouts ----------
  requestPayout(i: PayoutRequest): Payout {
    const existing = this.payouts.get(i.payoutId); if (existing) return existing; // idempotent
    const { ledger, audit, alerts } = this.deps;
    const kind = i.kind ?? "TRANSFER";
    if (!this.deps.potIds().includes(i.potId)) throw new Error(`pot ${i.potId} not found`);
    assertPositivePaise(i.amount, "payout");
    this.need(i.role, kind === "PROFIT" ? "PROFIT_WITHDRAW" : "PAYOUT_REQUEST");
    if (!i.recipientRef.trim()) throw new Error("recipient is required");
    const at = i.at ?? this.clock();
    const lim = this.limits;
    if (i.amount > lim.perTransactionLimit) throw new PayoutLimitError(`amount exceeds the per-transaction limit of ${lim.perTransactionLimit} paise`);
    const today = this.list(i.businessId).filter((p) => p.status !== "CANCELLED" && p.status !== "FAILED" && istDay(p.createdAt) === istDay(at)).reduce((a, p) => a + p.amount, 0);
    if (today + i.amount > lim.dailyLimit) throw new PayoutLimitError("daily payout limit would be exceeded");
    const avail = this.getAvailable(i.businessId, i.potId);
    if (i.amount > avail) throw new InsufficientFundsError(potAccount(i.potId), i.amount - avail); // shortfall + affected Pot
    const p: Payout = {
      id: i.payoutId, businessId: i.businessId, potId: i.potId, kind, amount: i.amount, fee: 0, recipientRef: i.recipientRef, maskedRef: maskRef(i.recipientRef),
      invoiceRef: i.invoiceRef, vendorId: i.vendorId, note: i.note, requestedBy: i.actorId, status: "PENDING_APPROVAL",
      highRisk: kind === "PROFIT" || i.amount >= lim.highRiskThreshold, simulated: true, createdAt: at,
    };
    this.payouts.set(p.id, p);
    audit.record({ businessId: p.businessId, actorId: i.actorId, action: "PAYOUT_REQUESTED", entity: "payout", entityId: p.id, after: { ...p, recipientRef: p.maskedRef }, at });
    if (p.highRisk) alerts.raise(p.businessId, "HIGH_RISK_ACTION_PENDING", `High-risk ${kind.toLowerCase()} payout ${p.id} awaiting approval`, at);
    return p;
  }

  approvePayout(i: { payoutId: string; actorId: string; role: ActorRole; stepUpVerified: boolean; at?: Date }): Payout {
    const p = this.must(i.payoutId);
    this.need(i.role, "PAYOUT_APPROVE");
    if (p.status !== "PENDING_APPROVAL") return p;
    if (p.highRisk && !i.stepUpVerified) throw new StepUpRequiredError("step-up authentication required to approve this payout");
    if (this.limits.requireSecondApproval && i.actorId === p.requestedBy) throw new PermissionError("maker-checker: approver must differ from requester");
    const at = i.at ?? this.clock();
    p.status = "APPROVED"; p.approvedBy = i.actorId; p.approvedAt = at;
    this.deps.audit.record({ businessId: p.businessId, actorId: i.actorId, action: "PAYOUT_APPROVED", entity: "payout", entityId: p.id, after: { status: p.status }, at });
    return p;
  }

  cancelPayout(payoutId: string, actorId: string, role: ActorRole): Payout {
    const p = this.must(payoutId);
    if (!(can(role, "PAYOUT_APPROVE", this.opts.grants) || (can(role, "PAYOUT_REQUEST", this.opts.grants) && actorId === p.requestedBy))) throw new PermissionError(`${role} cannot cancel this payout`);
    if (p.status === "PENDING_APPROVAL" || p.status === "APPROVED") {
      p.status = "CANCELLED";
      this.deps.audit.record({ businessId: p.businessId, actorId, action: "PAYOUT_CANCELLED", entity: "payout", entityId: p.id, at: this.clock() });
    }
    return p;
  }

  /** `providerResult` comes from the (simulated) provider integration layer. Ledger posts only on SUCCESS. */
  executePayout(payoutId: string, providerResult: { status: "SUCCESS" | "FAILED"; providerRef: string }, at = this.clock()): Payout {
    const p = this.must(payoutId);
    if (p.status === "SUCCESS" || p.status === "FAILED") return p; // idempotent
    if (p.status !== "APPROVED") throw new PermissionError("payout must be approved before execution");
    const { ledger, audit, alerts } = this.deps;
    p.providerRef = providerResult.providerRef;
    let failure: string | undefined = providerResult.status === "FAILED" ? "provider declined the payout" : undefined;
    if (!failure) {
      try {
        ledger.post(p.businessId, `payout:${p.id}`, p.id, [
          { account: potAccount(p.potId), amount: -p.amount, sourceType: "PAYOUT" },
          { account: "SETTLEMENT", amount: p.amount, sourceType: "PAYOUT" },
        ], "system", at, `${p.kind.toLowerCase()} payout`);
      } catch (e) { failure = e instanceof Error ? e.message : "ledger rejected the payout"; }
    }
    if (failure) {
      p.status = "FAILED"; p.failureReason = failure; // no ledger movement: the Pot is not reduced
      alerts.raise(p.businessId, "PAYOUT_FAILED", `Payout ${p.id} failed: ${failure}`, at);
    } else p.status = "SUCCESS";
    audit.record({ businessId: p.businessId, actorId: "system", action: `PAYOUT_${p.status}`, entity: "payout", entityId: p.id, after: { providerRef: p.providerRef, failure }, at });
    return p;
  }
  private must(id: string) { const p = this.payouts.get(id); if (!p) throw new Error("payout not found"); return p; }

  // ---------- manual Pot movements (reserve / transfer / owner override) ----------
  /** Moves money between Pots / UNALLOCATED. Owner only, step-up, mandatory reason, idempotent, balanced, audited. */
  move(i: { businessId: string; moveId: string; from: "UNALLOCATED" | { potId: string }; to: "UNALLOCATED" | { potId: string }; amount: Paise; reason: string; actorId: string; role: ActorRole; stepUpVerified: boolean; kind?: "TRANSFER" | "ADJUSTMENT"; at?: Date }) {
    this.need(i.role, "POT_ADJUST");
    if (!i.stepUpVerified) throw new StepUpRequiredError("manual override requires step-up authentication");
    if (!i.reason.trim()) throw new Error("a reason is required");
    assertPositivePaise(i.amount);
    const ids = this.deps.potIds();
    const acct = (x: "UNALLOCATED" | { potId: string }) => { if (x === "UNALLOCATED") return "UNALLOCATED" as const; if (!ids.includes(x.potId)) throw new Error(`pot ${x.potId} not found`); return potAccount(x.potId); };
    const from = acct(i.from), to = acct(i.to);
    if (from === to) throw new Error("source and destination must differ");
    if (typeof i.from !== "string" && i.amount > this.getAvailable(i.businessId, i.from.potId)) throw new InsufficientFundsError(from, i.amount - this.getAvailable(i.businessId, i.from.potId));
    const at = i.at ?? this.clock(); const st = i.kind ?? "ADJUSTMENT";
    const wrote = this.deps.ledger.post(i.businessId, `move:${i.moveId}`, i.moveId, [{ account: from, amount: -i.amount, sourceType: st }, { account: to, amount: i.amount, sourceType: st }], i.actorId, at, i.reason.trim());
    if (wrote) this.deps.audit.record({ businessId: i.businessId, actorId: i.actorId, action: st === "TRANSFER" ? "POT_TRANSFER" : "OWNER_ADJUSTMENT", entity: "pot", entityId: i.moveId, reason: i.reason.trim(), after: { from: i.from, to: i.to, amount: i.amount }, at });
    return { duplicate: !wrote };
  }
}
