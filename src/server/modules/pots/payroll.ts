/**
 * Salary distribution (Pots spec §9, acceptance #6-#9; v1.1 §14).
 *
 *   Salary Pot -> payroll period -> employee list -> edit adjustment (reason) -> save draft
 *   -> review total -> OWNER authorization (step-up) -> payout requests -> provider result
 *   -> ledger update -> audit.
 *
 * Rules enforced here:
 *  - the ORIGINAL salary is never overwritten; every edit is appended to the item's history
 *    with reason, actor and time;
 *  - only the owner edits or approves; edits are impossible after approval;
 *  - nothing is paid before the batch is approved with step-up;
 *  - a payout failure leaves the Pot untouched (PotsService only posts on SUCCESS) and the
 *    item can be retried;
 *  - payout destinations are shown masked, never as raw account numbers.
 *
 * Money movement goes through a PayoutPort (PotsService satisfies it), so the provider
 * integration stays isolated. All provider results are SIMULATED in the prototype.
 */
export type PayrollRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF";
export type Paise = number;

export interface PayoutPort {
  getAvailable(businessId: string, potId: string): Paise;
  requestPayout(i: { kind?: "SALARY"; businessId: string; payoutId: string; potId: string; amount: Paise; recipientRef: string; actorId: string; role: PayrollRole }): unknown;
  approvePayout(i: { payoutId: string; actorId: string; role: PayrollRole; stepUpVerified: boolean }): unknown;
  executePayout(payoutId: string, providerResult: { status: "SUCCESS" | "FAILED"; providerRef: string }): { status: string };
}
export type ProviderFn = (x: { payoutId: string; employeeId: string; amount: Paise; recipientRef: string }) => { status: "SUCCESS" | "FAILED"; providerRef: string };

export class PayrollError extends Error {}
export class PayrollPermissionError extends PayrollError {}
export class PayrollShortfallError extends PayrollError { constructor(public shortfall: Paise) { super(`Salary Pot is short by ${shortfall} paise`); } }

export interface Adjustment { from: Paise; to: Paise; reason: string; actorId: string; at: Date }
export type ItemStatus = "DRAFT" | "PAID" | "FAILED";
export interface PayrollItem {
  employeeId: string; name: string;
  /** Provider token / reference. Never a raw account number. */
  payoutRef: string; maskedPayoutRef: string;
  originalPaise: Paise; finalPaise: Paise;
  adjustments: Adjustment[]; status: ItemStatus; attempts: number; lastPayoutId?: string; failureReason?: string;
}
export type RunStatus = "DRAFT" | "APPROVED" | "COMPLETED" | "PARTIALLY_FAILED";
export interface PayrollRun {
  id: string; businessId: string; potId: string; period: string; status: RunStatus;
  items: PayrollItem[]; createdBy: string; approvedBy?: string; approvedAt?: Date; simulated: true;
}
export interface PayrollAudit { actorId: string; action: string; entityId: string; reason?: string; before?: unknown; after?: unknown; at: Date }

export function maskRef(ref: string): string {
  const t = ref.trim();
  return t.length <= 4 ? "****" : `${"*".repeat(Math.min(t.length - 4, 8))}${t.slice(-4)}`;
}
const isPaise = (n: number) => Number.isSafeInteger(n) && n >= 0;

export class PayrollService {
  private runs = new Map<string, PayrollRun>();
  readonly audit: PayrollAudit[] = [];
  constructor(private port: PayoutPort, private clock: () => Date = () => new Date()) {}

  private log(e: Omit<PayrollAudit, "at">) { this.audit.push({ ...e, at: this.clock() }); }
  private owner(role: PayrollRole, what: string) { if (role !== "OWNER") throw new PayrollPermissionError(`only the owner can ${what}`); }
  list(businessId: string): PayrollRun[] { return [...this.runs.values()].filter((r) => r.businessId === businessId); }
  get(id: string): PayrollRun { const r = this.runs.get(id); if (!r) throw new PayrollError("payroll run not found"); return r; }

  createRun(i: { runId: string; businessId: string; potId: string; period: string; actorId: string; role: PayrollRole;
    employees: { employeeId: string; name: string; payoutRef: string; salaryPaise: Paise }[] }): PayrollRun {
    this.owner(i.role, "create a payroll run");
    const existing = this.runs.get(i.runId); if (existing) return existing; // idempotent
    if (!i.employees.length) throw new PayrollError("a payroll run needs at least one employee");
    const seen = new Set<string>();
    const items = i.employees.map((e): PayrollItem => {
      if (seen.has(e.employeeId)) throw new PayrollError(`duplicate employee ${e.employeeId}`);
      seen.add(e.employeeId);
      if (!isPaise(e.salaryPaise)) throw new PayrollError("salary must be whole paise >= 0");
      return { employeeId: e.employeeId, name: e.name, payoutRef: e.payoutRef, maskedPayoutRef: maskRef(e.payoutRef), originalPaise: e.salaryPaise, finalPaise: e.salaryPaise, adjustments: [], status: "DRAFT", attempts: 0 };
    });
    const run: PayrollRun = { id: i.runId, businessId: i.businessId, potId: i.potId, period: i.period, status: "DRAFT", items, createdBy: i.actorId, simulated: true };
    this.runs.set(run.id, run);
    this.log({ actorId: i.actorId, action: "PAYROLL_RUN_CREATED", entityId: run.id, after: { period: i.period, total: this.total(run).final } });
    return run;
  }

  /** Owner edit of one employee's payable amount. The original is kept; a reason is mandatory. */
  adjustItem(i: { runId: string; employeeId: string; newAmountPaise: Paise; reason: string; actorId: string; role: PayrollRole }): PayrollItem {
    this.owner(i.role, "edit a salary item");
    const run = this.get(i.runId);
    if (run.status !== "DRAFT") throw new PayrollError("an approved payroll run can no longer be edited");
    if (!i.reason.trim()) throw new PayrollError("a reason is required for every salary adjustment");
    if (!isPaise(i.newAmountPaise)) throw new PayrollError("adjusted amount must be whole paise >= 0");
    const item = run.items.find((x) => x.employeeId === i.employeeId);
    if (!item) throw new PayrollError("employee not in this run");
    if (i.newAmountPaise === item.finalPaise) return item;
    const adj: Adjustment = { from: item.finalPaise, to: i.newAmountPaise, reason: i.reason.trim(), actorId: i.actorId, at: this.clock() };
    item.adjustments.push(adj); item.finalPaise = i.newAmountPaise; // originalPaise is never touched
    this.log({ actorId: i.actorId, action: "PAYROLL_ITEM_ADJUSTED", entityId: `${run.id}:${item.employeeId}`, reason: adj.reason, before: { amount: adj.from }, after: { amount: adj.to } });
    return item;
  }

  total(run: PayrollRun) {
    const original = run.items.reduce((a, x) => a + x.originalPaise, 0);
    const final = run.items.reduce((a, x) => a + x.finalPaise, 0);
    return { original, final, adjustmentTotal: final - original };
  }

  /** Salary Review screen: original vs edited side by side, total payout and remaining Pot balance. */
  review(runId: string) {
    const run = this.get(runId); const t = this.total(run);
    const available = this.port.getAvailable(run.businessId, run.potId);
    return {
      run, totals: t, availableInPot: available,
      remainingAfterPayout: available - t.final, shortfall: Math.max(0, t.final - available),
      rows: run.items.map((x) => ({ employeeId: x.employeeId, name: x.name, payoutTo: x.maskedPayoutRef, original: x.originalPaise, final: x.finalPaise, reason: x.adjustments.at(-1)?.reason ?? null, changed: x.finalPaise !== x.originalPaise })),
    };
  }

  /** Owner authorization of the whole batch. Needs step-up and enough funds. */
  approve(i: { runId: string; actorId: string; role: PayrollRole; stepUpVerified: boolean }): PayrollRun {
    this.owner(i.role, "approve a salary batch");
    if (!i.stepUpVerified) throw new PayrollPermissionError("salary batch approval requires step-up authentication");
    const run = this.get(i.runId);
    if (run.status !== "DRAFT") return run; // idempotent
    const r = this.review(run.id);
    if (r.shortfall > 0) throw new PayrollShortfallError(r.shortfall);
    run.status = "APPROVED"; run.approvedBy = i.actorId; run.approvedAt = this.clock();
    this.log({ actorId: i.actorId, action: "PAYROLL_APPROVED", entityId: run.id, after: { total: r.totals.final } });
    return run;
  }

  /** Requests, approves and executes one payout per employee. Safe to call again to retry FAILED items. */
  execute(i: { runId: string; actorId: string; provider: ProviderFn }): PayrollRun {
    const run = this.get(i.runId);
    if (run.status === "DRAFT") throw new PayrollPermissionError("payroll run must be approved by the owner before payout");
    for (const item of run.items) {
      if (item.status === "PAID" || item.finalPaise === 0) { if (item.finalPaise === 0) item.status = "PAID"; continue; }
      item.attempts += 1;
      const payoutId = `payroll:${run.id}:${item.employeeId}:${item.attempts}`;
      item.lastPayoutId = payoutId;
      try {
        this.port.requestPayout({ kind: "SALARY", businessId: run.businessId, payoutId, potId: run.potId, amount: item.finalPaise, recipientRef: item.payoutRef, actorId: i.actorId, role: "OWNER" });
        // The batch was authorized by the owner with step-up in approve(); that authorization is carried here.
        this.port.approvePayout({ payoutId, actorId: run.approvedBy ?? i.actorId, role: "OWNER", stepUpVerified: true });
        const res = this.port.executePayout(payoutId, i.provider({ payoutId, employeeId: item.employeeId, amount: item.finalPaise, recipientRef: item.payoutRef }));
        if (res.status === "SUCCESS") { item.status = "PAID"; item.failureReason = undefined; }
        else { item.status = "FAILED"; item.failureReason = "provider declined"; }
      } catch (e) {
        item.status = "FAILED"; item.failureReason = e instanceof Error ? e.message : "unknown error";
      }
      this.log({ actorId: i.actorId, action: `PAYROLL_ITEM_${item.status}`, entityId: `${run.id}:${item.employeeId}`, reason: item.failureReason, after: { payoutId, amount: item.finalPaise } });
    }
    run.status = run.items.every((x) => x.status === "PAID") ? "COMPLETED" : "PARTIALLY_FAILED";
    return run;
  }
}
