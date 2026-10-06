import { beforeEach, describe, expect, it } from "vitest";
import { PotsService } from "../pots-service";
import { PayrollService, maskRef, PayrollPermissionError, PayrollShortfallError, PayrollError, type ProviderFn } from "../payroll";
import { rupees as R } from "../money";

const B = "biz"; const SAL = `${B}:STAFF_SALARY`;
const ok: ProviderFn = (x) => ({ status: "SUCCESS", providerRef: `sim_${x.payoutId}` });
const bad: ProviderFn = (x) => ({ status: "FAILED", providerRef: `sim_${x.payoutId}` });
let pots: PotsService; let pay: PayrollService;

function fund(amount: number) {
  pots.handlePaymentEvent({ businessId: B, eventId: `e${amount}`, paymentId: `p${amount}`, billId: "b", status: "SUCCESS", amount });
  pots.ownerAdjust({ businessId: B, adjustmentId: `a${amount}`, from: "UNALLOCATED", to: { potId: SAL }, amount, reason: "seed", actorId: "o", role: "OWNER", stepUpVerified: true });
}
const emps = [
  { employeeId: "A", name: "Asha", payoutRef: "9876543210", salaryPaise: R(30000) },
  { employeeId: "B", name: "Bala", payoutRef: "1234567890", salaryPaise: R(30000) },
];
const draft = () => pay.createRun({ runId: "r1", businessId: B, potId: SAL, period: "2026-10", actorId: "o", role: "OWNER", employees: emps });

describe("payroll (Pots spec §9)", () => {
  beforeEach(() => { pots = new PotsService(); pots.createDefaultPots(B); pay = new PayrollService(pots); fund(R(100000)); });

  it("masks payout identifiers", () => { expect(maskRef("9876543210")).toBe("******3210"); expect(pay.review(draft().id).rows[0]!.payoutTo).toBe("******3210"); });

  it("edit needs a reason, keeps the original, records actor and history", () => {
    draft();
    expect(() => pay.adjustItem({ runId: "r1", employeeId: "B", newAmountPaise: R(22500), reason: "  ", actorId: "o", role: "OWNER" })).toThrow(PayrollError);
    pay.adjustItem({ runId: "r1", employeeId: "B", newAmountPaise: R(22500), reason: "1 week absent", actorId: "o", role: "OWNER" });
    const it = pay.get("r1").items[1]!;
    expect(it.originalPaise).toBe(R(30000)); expect(it.finalPaise).toBe(R(22500));
    expect(it.adjustments[0]).toMatchObject({ from: R(30000), to: R(22500), reason: "1 week absent", actorId: "o" });
    expect(pay.review("r1").totals.final).toBe(R(52500));
  });

  it("only the owner edits / approves, and step-up is required", () => {
    draft();
    expect(() => pay.adjustItem({ runId: "r1", employeeId: "A", newAmountPaise: 1, reason: "x", actorId: "m", role: "MANAGER" })).toThrow(PayrollPermissionError);
    expect(() => pay.approve({ runId: "r1", actorId: "m", role: "MANAGER", stepUpVerified: true })).toThrow(PayrollPermissionError);
    expect(() => pay.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: false })).toThrow(PayrollPermissionError);
  });

  it("no payout before approval; no edits after approval", () => {
    draft();
    expect(() => pay.execute({ runId: "r1", actorId: "o", provider: ok })).toThrow(PayrollPermissionError);
    pay.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(() => pay.adjustItem({ runId: "r1", employeeId: "A", newAmountPaise: 1, reason: "x", actorId: "o", role: "OWNER" })).toThrow(PayrollError);
    expect(pots.getPotBalance(B, SAL)).toBe(R(100000));
  });

  it("approval is blocked with a shortfall when the Salary Pot is too small", () => {
    pay.createRun({ runId: "big", businessId: B, potId: SAL, period: "p", actorId: "o", role: "OWNER", employees: [{ employeeId: "X", name: "X", payoutRef: "1111222233", salaryPaise: R(150000) }] });
    expect(() => pay.approve({ runId: "big", actorId: "o", role: "OWNER", stepUpVerified: true })).toThrow(PayrollShortfallError);
  });

  it("payout success updates payout record AND Pot ledger; ledger still reconciles", () => {
    draft(); pay.adjustItem({ runId: "r1", employeeId: "B", newAmountPaise: R(22500), reason: "absent", actorId: "o", role: "OWNER" });
    pay.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: true });
    const run = pay.execute({ runId: "r1", actorId: "o", provider: ok });
    expect(run.status).toBe("COMPLETED");
    expect(pots.getPotBalance(B, SAL)).toBe(R(100000) - R(52500));
    expect(pots.getPayout(run.items[0]!.lastPayoutId!)!.status).toBe("SUCCESS");
    expect(pots.reconcile(B).ok).toBe(true);
  });

  it("payout failure does not reduce the Pot, and the item can be retried", () => {
    draft(); pay.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(pay.execute({ runId: "r1", actorId: "o", provider: bad }).status).toBe("PARTIALLY_FAILED");
    expect(pots.getPotBalance(B, SAL)).toBe(R(100000));
    expect(pay.execute({ runId: "r1", actorId: "o", provider: ok }).status).toBe("COMPLETED");
    expect(pots.getPotBalance(B, SAL)).toBe(R(40000));
    expect(pay.execute({ runId: "r1", actorId: "o", provider: ok }).status).toBe("COMPLETED"); // replay pays nobody twice
    expect(pots.getPotBalance(B, SAL)).toBe(R(40000));
  });

  it("every step is audited", () => {
    draft(); pay.adjustItem({ runId: "r1", employeeId: "A", newAmountPaise: R(1), reason: "r", actorId: "o", role: "OWNER" });
    pay.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(pay.audit.map((a) => a.action)).toEqual(["PAYROLL_RUN_CREATED", "PAYROLL_ITEM_ADJUSTED", "PAYROLL_APPROVED"]);
  });
});

describe("high-risk refunds and payout cancel (Pots spec §11)", () => {
  it("large refunds need step-up; payout cancel is permission-checked", () => {
    const s = new PotsService({ highRiskRefundThreshold: R(500) }); s.createDefaultPots(B);
    s.handlePaymentEvent({ businessId: B, eventId: "e", paymentId: "p", billId: "b", status: "SUCCESS", amount: R(2000) });
    expect(() => s.refundPayment({ businessId: B, refundId: "r1", paymentId: "p", amount: R(600), actorId: "o", role: "OWNER", reason: "x" })).toThrow();
    expect(s.refundPayment({ businessId: B, refundId: "r1", paymentId: "p", amount: R(600), actorId: "o", role: "OWNER", reason: "x", stepUpVerified: true }).duplicate).toBe(false);
    s.ownerAdjust({ businessId: B, adjustmentId: "a", from: "UNALLOCATED", to: { potId: `${B}:INVENTORY` }, amount: R(100), reason: "s", actorId: "o", role: "OWNER", stepUpVerified: true });
    const p = s.requestPayout({ businessId: B, payoutId: "po", potId: `${B}:INVENTORY`, amount: R(50), recipientRef: "tok", actorId: "mgr", role: "MANAGER" });
    expect(() => s.cancelPayout(p.id, "stranger", "STAFF")).toThrow();
    expect(s.cancelPayout(p.id, "mgr", "MANAGER").status).toBe("CANCELLED");
  });
});
