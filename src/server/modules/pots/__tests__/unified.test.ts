import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID as B, getPotsRuntime, resetPotsRuntimeForTests } from "../runtime";
import { PayoutLimitError, simulatedProvider } from "../payouts";
import { InsufficientFundsError } from "../ledger";
import { PermissionError, StepUpRequiredError } from "../support";
import { buildGstView, gstCsv, buildReports, buildPaymentResult } from "../reports";
import { parseRupees, rupees as R } from "../money";
import { can } from "../permissions";

const T = new Date("2026-10-03T10:00:00Z");
const pot = (t: string) => `${B}:${t}`;
const rt = () => getPotsRuntime();
function pay(ref: string, amount: number) { rt().payments.handleEvent({ providerEventId: `e-${ref}`, providerRef: ref, businessId: B, billId: `b-${ref}`, amount, status: "SUCCESS", at: T }); }
function reserve(type: string, amount: number, id = `m-${type}-${amount}`) {
  rt().payouts.move({ businessId: B, moveId: id, from: "UNALLOCATED", to: { potId: pot(type) }, amount, reason: "reserve", actorId: "o", role: "OWNER", stepUpVerified: true, at: T });
}
const req = (id: string, potType: string, amount: number, role: "OWNER" | "MANAGER" = "OWNER", kind: any = "SUPPLIER") =>
  rt().payouts.requestPayout({ businessId: B, payoutId: id, potId: pot(potType), amount, recipientRef: "supplier-token-9988", actorId: role === "OWNER" ? "o" : "m", role, kind, at: T });

describe("single Pots ledger now owns payouts, transfers and adjustments", () => {
  beforeEach(() => { resetPotsRuntimeForTests(); pay("p1", R(100000)); });

  it("parseRupees is strict", () => {
    expect(parseRupees("1180")).toBe(118000); expect(parseRupees("1180.5")).toBe(118050); expect(parseRupees("0.07")).toBe(7);
    expect(parseRupees("-1")).toBeNull(); expect(parseRupees("1e3")).toBeNull(); expect(parseRupees("1.234")).toBeNull(); expect(parseRupees("")).toBeNull();
  });
  it("permissions follow spec §4", () => {
    expect(can("MANAGER", "PAYOUT_APPROVE")).toBe(false); expect(can("ACCOUNTANT", "PAYOUT_REQUEST")).toBe(false);
    expect(can("ACCOUNTANT", "REPORTS_VIEW")).toBe(true); expect(can("STAFF", "LEDGER_VIEW")).toBe(false);
  });
  it("reserve needs owner + step-up + reason; ledger still reconciles", () => {
    const m = (o: object) => () => rt().payouts.move({ businessId: B, moveId: "x", from: "UNALLOCATED", to: { potId: pot("INVENTORY") }, amount: R(100), reason: "r", actorId: "o", role: "OWNER", stepUpVerified: true, ...o });
    expect(m({ role: "MANAGER" })).toThrow(PermissionError); expect(m({ stepUpVerified: false })).toThrow(StepUpRequiredError); expect(m({ reason: " " })).toThrow();
    m({})(); expect(m({})()).toEqual({ duplicate: true });
    expect(rt().ledger.potBalance(B, pot("INVENTORY"))).toBe(R(100)); expect(rt().ledger.reconcile(B, rt().potIds).ok).toBe(true);
  });
  it("cannot move more than the Pot's available balance", () => {
    reserve("INVENTORY", R(100));
    expect(() => rt().payouts.move({ businessId: B, moveId: "t", from: { potId: pot("INVENTORY") }, to: "UNALLOCATED", amount: R(101), reason: "r", actorId: "o", role: "OWNER", stepUpVerified: true })).toThrow(InsufficientFundsError);
  });
  it("supplier payment: request -> approve -> execute posts ledger once; manager cannot approve", () => {
    reserve("INVENTORY", R(10000)); const p = req("s1", "INVENTORY", R(4000), "MANAGER");
    expect(() => rt().payouts.approvePayout({ payoutId: "s1", actorId: "m", role: "MANAGER", stepUpVerified: true })).toThrow(PermissionError);
    expect(() => rt().payouts.executePayout("s1", simulatedProvider("s1"))).toThrow();
    rt().payouts.approvePayout({ payoutId: "s1", actorId: "o", role: "OWNER", stepUpVerified: false });
    rt().payouts.executePayout("s1", simulatedProvider("s1"), T); rt().payouts.executePayout("s1", simulatedProvider("s1"), T);
    expect(rt().ledger.potBalance(B, pot("INVENTORY"))).toBe(R(6000)); expect(rt().ledger.reconcile(B, rt().potIds).ok).toBe(true);
    expect(rt().ledger.merchantFunds(B)).toBe(R(96000));
  });
  it("pending payouts reserve funds; insufficient funds shows shortfall; failure leaves Pot untouched", () => {
    reserve("MAINTENANCE", R(1000)); req("a", "MAINTENANCE", R(800));
    expect(() => req("b", "MAINTENANCE", R(300))).toThrow(InsufficientFundsError);
    rt().payouts.approvePayout({ payoutId: "a", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(rt().payouts.executePayout("a", simulatedProvider("a", "FAILED"), T).status).toBe("FAILED");
    expect(rt().ledger.potBalance(B, pot("MAINTENANCE"))).toBe(R(1000)); expect(rt().payouts.getAvailable(B, pot("MAINTENANCE"))).toBe(R(1000));
  });
  it("profit withdrawal is always high-risk and needs step-up + owner; maker-checker option works", () => {
    reserve("OWNER_PROFIT", R(5000));
    expect(() => req("pw", "OWNER_PROFIT", R(100), "MANAGER", "PROFIT")).toThrow(PermissionError);
    const p = req("pw", "OWNER_PROFIT", R(100), "OWNER", "PROFIT"); expect(p.highRisk).toBe(true);
    expect(() => rt().payouts.approvePayout({ payoutId: "pw", actorId: "o", role: "OWNER", stepUpVerified: false })).toThrow(StepUpRequiredError);
  });
  it("transaction and daily limits are enforced", () => {
    reserve("INVENTORY", R(100000) - 1);
    expect(() => req("big", "INVENTORY", R(1_000_001))).toThrow(PayoutLimitError);
  });
  it("GST reserve view: by period, source rows, CSV export, no direct tax payment", () => {
    rt().registry.publish(B, { ruleKey: "gst", potId: pot("GST"), method: "PERCENTAGE", value: 1500, priority: 1, effectiveFrom: new Date(0) }, { id: "o", role: "OWNER" }, { stepUpVerified: true, reason: "t", at: T });
    pay("p2", R(1000));
    const v = buildGstView(rt())!; expect(v.reservedInMonth).toBe(R(150)); expect(v.directPaymentAvailable).toBe(false); expect(v.rows).toHaveLength(1);
    expect(gstCsv(rt()).split("\n")).toHaveLength(2);
  });
  it("reports and payment result derive from the ledger", () => {
    const r = buildReports(rt()); expect(r.dailySales[0]!.amount).toBe(R(100000)); expect(r.reconciliation.ok).toBe(true);
    const pr = buildPaymentResult(rt(), "p1")!; expect(pr.status).toBe("SUCCESS"); expect(pr.allocationStatus).toBe("UNALLOCATED"); expect(pr.simulated).toBe(true);
  });
  it("salary payroll now runs on the unified ledger", () => {
    reserve("SALARY", R(60000));
    const d = rt().directory; const a = d.addEmployee(B, { name: "Asha", payoutRef: "acct-token-1111", salaryPaise: R(30000) }, "OWNER");
    const b = d.addEmployee(B, { name: "Bala", payoutRef: "acct-token-2222", salaryPaise: R(30000) }, "OWNER");
    expect(() => d.addEmployee(B, { name: "x", payoutRef: "acct-token-3333", salaryPaise: 1 }, "MANAGER")).toThrow(PermissionError);
    rt().payroll.createRun({ runId: "r1", businessId: B, potId: pot("SALARY"), period: "2026-10", actorId: "o", role: "OWNER", employees: [a, b].map((e) => ({ employeeId: e.id, name: e.name, payoutRef: e.payoutRef, salaryPaise: e.salaryPaise })) });
    rt().payroll.adjustItem({ runId: "r1", employeeId: b.id, newAmountPaise: R(22500), reason: "1 week absent", actorId: "o", role: "OWNER" });
    rt().payroll.approve({ runId: "r1", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(rt().payroll.execute({ runId: "r1", actorId: "o", provider: (x) => simulatedProvider(x.payoutId) }).status).toBe("COMPLETED");
    expect(rt().ledger.potBalance(B, pot("SALARY"))).toBe(R(60000) - R(52500)); expect(rt().ledger.reconcile(B, rt().potIds).ok).toBe(true);
    expect(buildReports(rt()).payroll[0]!.adjustments[0]!.reason).toBe("1 week absent");
  });
});
