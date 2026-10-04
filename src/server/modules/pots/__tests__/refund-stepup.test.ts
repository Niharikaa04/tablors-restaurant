import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_BUSINESS_ID as B, getPotsRuntime, resetPotsRuntimeForTests } from "../runtime";
import { buildTransactionsView } from "../views";
import { rupees as R } from "../money";

const T = new Date("2026-10-03T10:00:00Z");
describe("live refund path: step-up for large refunds + transactions view", () => {
  beforeEach(() => {
    resetPotsRuntimeForTests();
    getPotsRuntime().payments.handleEvent({ providerEventId: "e1", providerRef: "p1", businessId: B, billId: "b1", amount: R(20000), status: "SUCCESS", at: T });
  });
  it("small refund applies without step-up", () => {
    expect(getPotsRuntime().payments.refund({ refundId: "r1", providerRef: "p1", amount: R(100), actorId: "o", reason: "x", at: T }).status).toBe("APPLIED");
  });
  it("large refund writes nothing and alerts until step-up is verified", () => {
    const rt = getPotsRuntime(); const before = rt.ledger.merchantFunds(B);
    const r = rt.payments.refund({ refundId: "r2", providerRef: "p1", amount: R(6000), actorId: "o", reason: "x", at: T });
    expect(r.status).toBe("STEP_UP_REQUIRED");
    expect(rt.ledger.merchantFunds(B)).toBe(before);
    expect(rt.alerts.list(B).some((a) => a.code === "HIGH_RISK_ACTION_PENDING")).toBe(true);
    expect(rt.payments.refund({ refundId: "r2", providerRef: "p1", amount: R(6000), actorId: "o", reason: "x", at: T, stepUpVerified: true }).status).toBe("APPLIED");
    expect(rt.ledger.merchantFunds(B)).toBe(before - R(6000));
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
  });
  it("transactions view lists payments and reversals, filterable, newest first", () => {
    const rt = getPotsRuntime();
    rt.payments.refund({ refundId: "r1", providerRef: "p1", amount: R(100), actorId: "o", reason: "oops", at: new Date(T.getTime() + 1000) });
    const all = buildTransactionsView(rt, "ALL");
    expect(all.rows[0]!.label).toBe("Refund");
    expect(buildTransactionsView(rt, "PAYMENTS").rows).toHaveLength(1);
    expect(buildTransactionsView(rt, "REFUNDS").rows.every((x) => x.label.startsWith("Refund"))).toBe(true);
    expect(all.reconciliation.ok).toBe(true);
  });
});
