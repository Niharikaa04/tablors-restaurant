import { describe, it, expect } from "vitest";
import { PotsService, InsufficientFundsError, StepUpRequiredError, PermissionError, RefundShortfallError } from "../pots-service";
import { rupees as R } from "../money";

const B = "b1";
function setup(opts = {}) {
  let t = new Date("2026-10-05T10:00:00Z");
  const s = new PotsService({ clock: () => t, ...opts });
  s.createDefaultPots(B);
  const pot = (type: string) => `${B}:${type}`;
  const rule = (ruleKey: string, type: string, method: any, value: number, priority: number, extra = {}) =>
    s.createRule({ ruleKey, businessId: B, potId: pot(type), method, value, priority, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, enabled: true, ...extra }, "owner1", "OWNER", true);
  // Test-only rule values (NOT product defaults).
  rule("inv", "INVENTORY", "PERCENTAGE", 2000, 1);
  rule("sal", "STAFF_SALARY", "FIXED", R(100), 2);
  rule("profit", "OWNER_PROFIT", "REMAINING", 0, 99);
  const pay = (id: string, amount = R(1000), status: "SUCCESS" | "PENDING" | "FAILED" = "SUCCESS", ev = id + ":e1") =>
    s.handlePaymentEvent({ businessId: B, eventId: ev, paymentId: id, billId: "bill_" + id, status, amount });
  return { s, pot, rule, pay, setClock: (d: Date) => (t = d) };
}

describe("payment -> allocation", () => {
  it("successful payment allocates, marks bill paid, reconciles", () => {
    const { s, pot, pay } = setup();
    const r = pay("P1");
    expect(r.outcome).toBe("ALLOCATED");
    expect(s.getPotBalance(B, pot("INVENTORY"))).toBe(R(200));
    expect(s.getPotBalance(B, pot("STAFF_SALARY"))).toBe(R(100));
    expect(s.getPotBalance(B, pot("OWNER_PROFIT"))).toBe(R(700));
    expect(s.getPayment(B, "P1")!.billPaid).toBe(true);
    const rec = s.reconcile(B); expect(rec.ok).toBe(true); expect(rec.fundsRepresented).toBe(R(1000));
  });
  it("duplicate webhook (same event id) and replayed success (new event id) allocate once", () => {
    const { s, pay } = setup();
    pay("P1"); expect(pay("P1").outcome).toBe("DUPLICATE_EVENT");
    expect(pay("P1", R(1000), "SUCCESS", "other-event").outcome).toBe("ALREADY_ALLOCATED");
    expect(s.reconcile(B).fundsRepresented).toBe(R(1000));
  });
  it("pending and failed do not allocate; failed attempt retained; pending then success allocates", () => {
    const { s, pay } = setup();
    expect(pay("P2", R(500), "PENDING").outcome).toBe("PENDING_RECORDED");
    expect(pay("P3", R(500), "FAILED").outcome).toBe("FAILED_RECORDED");
    expect(s.reconcile(B).fundsRepresented).toBe(0);
    expect(s.attempts.some((a) => a.paymentId === "P3" && a.status === "FAILED")).toBe(true);
    expect(pay("P2", R(500), "SUCCESS", "P2:e2").outcome).toBe("ALLOCATED");
    expect(s.reconcile(B).fundsRepresented).toBe(R(500));
  });
  it("non-eligible portion and engine remainder are tracked as unallocated (no rule for remainder)", () => {
    const s = new PotsService(); s.createDefaultPots(B);
    s.createRule({ ruleKey: "i", businessId: B, potId: `${B}:INVENTORY`, method: "PERCENTAGE", value: 1000, priority: 1, effectiveFrom: new Date("2020-01-01"), enabled: true }, "o", "OWNER", true);
    s.handlePaymentEvent({ businessId: B, eventId: "e", paymentId: "P", billId: "b", status: "SUCCESS", amount: R(1180), eligible: R(1000) });
    expect(s.getPotBalance(B, `${B}:INVENTORY`)).toBe(R(100));
    expect(s.getUnallocated(B)).toBe(R(1080));
    expect(s.getDashboard(B).unallocated).toBe(R(1080));
    expect(s.reconcile(B).ok).toBe(true);
  });
  it("monthly target is month-aware", () => {
    const { s, pot, rule, pay, setClock } = setup();
    rule("goal", "MAINTENANCE", "MONTHLY_TARGET", R(150), 3);
    pay("A", R(1000)); pay("B", R(1000)); // 150 then 0
    expect(s.getPotBalance(B, pot("MAINTENANCE"))).toBe(R(150));
    setClock(new Date("2026-11-02T10:00:00Z")); pay("C", R(1000));
    expect(s.getPotBalance(B, pot("MAINTENANCE"))).toBe(R(300));
  });
});

describe("rule versions", () => {
  it("revising a rule never changes past allocations; future uses new version", () => {
    const { s, pot, pay, setClock } = setup();
    pay("P1");
    const before = s.getEntries(B).map((e) => ({ ...e }));
    setClock(new Date("2026-10-06T10:00:00Z"));
    const v2 = s.reviseRule(B, "inv", { value: 1000 }, "owner1", "OWNER", true);
    expect(v2.version).toBe(2);
    expect(s.getEntries(B).slice(0, before.length)).toEqual(before);
    pay("P2");
    const invEntries = s.getEntries(B, `POT:${pot("INVENTORY")}`);
    expect(invEntries.map((e) => [e.amount, e.ruleVersion])).toEqual([[R(200), 1], [R(100), 2]]);
    expect(s.getPayment(B, "P1")!.allocation!.lines.find((l) => l.ruleKey === "inv")!.ruleVersion).toBe(1);
  });
  it("rule changes need step-up and OWNER", () => {
    const { s, rule } = setup();
    expect(() => s.reviseRule(B, "inv", { value: 1 }, "o", "OWNER", false)).toThrow(StepUpRequiredError);
    expect(() => s.reviseRule(B, "inv", { value: 1 }, "m", "MANAGER", true)).toThrow(PermissionError);
    expect(s.auditLogs.some((a) => a.action === "RULE_CREATED")).toBe(true);
    void rule;
  });
});

describe("refunds / disputes / ledger immutability", () => {
  it("refund appends reversal entries, never edits old rows, and reconciles", () => {
    const { s, pot, pay } = setup(); pay("P1");
    const old = s.getEntries(B).map((e) => ({ ...e }));
    s.refundPayment({ businessId: B, refundId: "R1", paymentId: "P1", amount: R(500), actorId: "o", role: "OWNER", reason: "customer" });
    expect(s.getEntries(B).slice(0, old.length)).toEqual(old);
    expect(s.getPotBalance(B, pot("OWNER_PROFIT"))).toBe(R(350));
    expect(s.getPotBalance(B, pot("INVENTORY"))).toBe(R(100));
    expect(s.reconcile(B)).toMatchObject({ ok: true, fundsRepresented: R(500) });
    expect(s.refundPayment({ businessId: B, refundId: "R1", paymentId: "P1", amount: R(500), actorId: "o", role: "OWNER", reason: "x" })).toEqual({ duplicate: true });
    expect(() => s.refundPayment({ businessId: B, refundId: "R2", paymentId: "P1", amount: R(600), actorId: "o", role: "OWNER", reason: "x" })).toThrow();
  });
  it("refund that cannot be covered is blocked and logged as exception (no negative pots)", () => {
    const { s, pot, pay } = setup(); pay("P1");
    const prof = pot("OWNER_PROFIT");
    const p = s.requestPayout({ businessId: B, payoutId: "W", potId: prof, amount: R(700), recipientRef: "tok_1", actorId: "o", role: "OWNER" });
    s.approvePayout({ payoutId: p.id, actorId: "o", role: "OWNER", stepUpVerified: true });
    s.executePayout(p.id, { status: "SUCCESS", providerRef: "sim_1" });
    // pots now: inv 200, sal 100, profit 0; refund everything -> profit share 700 uncovered, no unallocated
    expect(() => s.refundPayment({ businessId: B, refundId: "R", paymentId: "P1", amount: R(1000), actorId: "o", role: "OWNER", reason: "x" })).toThrow(RefundShortfallError);
    expect(s.exceptions.some((e) => e.type === "REFUND_SHORTFALL")).toBe(true);
    expect(s.getPotBalance(B, prof)).toBe(0); expect(s.reconcile(B).ok).toBe(true);
  });
  it("chargeback freezes funds, then LOST releases / WON restores", () => {
    const { s, pot, pay } = setup(); pay("P1");
    s.openDispute({ businessId: B, disputeId: "D1", paymentId: "P1", actorId: "o" });
    expect(s.getPotBalance(B, pot("OWNER_PROFIT"))).toBe(0);
    expect(s.reconcile(B)).toMatchObject({ ok: true, disputeHold: R(1000) });
    s.resolveDispute(B, "D1", "WON", "o");
    expect(s.getPotBalance(B, pot("OWNER_PROFIT"))).toBe(R(700)); expect(s.reconcile(B).ok).toBe(true);
    s.openDispute({ businessId: B, disputeId: "D2", paymentId: "P1", actorId: "o" });
    s.resolveDispute(B, "D2", "LOST", "o");
    expect(s.reconcile(B)).toMatchObject({ ok: true, fundsRepresented: 0 });
  });
  it("settlement mismatch raises exception and leaves balances untouched", () => {
    const { s, pay } = setup(); pay("P1");
    const before = s.reconcile(B);
    s.recordSettlement({ id: "S1", businessId: B, gross: R(1000), fees: R(20), net: R(900), paymentIds: ["P1"] });
    expect(s.exceptions.some((e) => e.type === "SETTLEMENT_MISMATCH")).toBe(true);
    expect(s.reconcile(B)).toEqual(before);
  });
  it("entries are frozen (append-only) and business-scoped", () => {
    const { s, pay } = setup(); pay("P1");
    expect(() => { (s.getEntries(B)[0] as any).amount = 1; }).toThrow();
    expect(s.getEntries("other")).toHaveLength(0);
  });
});

describe("payouts", () => {
  it("success reduces pot once (idempotent); failure leaves pot intact", () => {
    const { s, pot, pay } = setup(); pay("P1");
    const inv = pot("INVENTORY");
    const p = s.requestPayout({ businessId: B, payoutId: "O1", potId: inv, amount: R(150), recipientRef: "vendor_tok", actorId: "m", role: "MANAGER" });
    expect(s.getAvailable(B, inv)).toBe(R(50)); // reserved, not yet spent
    expect(() => s.executePayout(p.id, { status: "SUCCESS", providerRef: "x" })).toThrow(); // unapproved
    s.approvePayout({ payoutId: p.id, actorId: "o", role: "OWNER", stepUpVerified: true });
    s.executePayout(p.id, { status: "SUCCESS", providerRef: "sim_9" }); s.executePayout(p.id, { status: "SUCCESS", providerRef: "sim_9" });
    expect(s.getPotBalance(B, inv)).toBe(R(50)); expect(s.reconcile(B)).toMatchObject({ ok: true, fundsRepresented: R(850) });
    const f = s.requestPayout({ businessId: B, payoutId: "O2", potId: inv, amount: R(50), recipientRef: "t", actorId: "o", role: "OWNER" });
    s.approvePayout({ payoutId: f.id, actorId: "o", role: "OWNER", stepUpVerified: true });
    s.executePayout(f.id, { status: "FAILED", providerRef: "sim_f" });
    expect(s.getPotBalance(B, inv)).toBe(R(50)); expect(s.getAvailable(B, inv)).toBe(R(50)); expect(f.status).toBe("FAILED");
  });
  it("blocks over-spend with shortfall; profit withdrawal is owner-only and high-risk step-up", () => {
    const { s, pot, pay } = setup(); pay("P1");
    expect(() => s.requestPayout({ businessId: B, payoutId: "X", potId: pot("MAINTENANCE"), amount: R(1), recipientRef: "t", actorId: "o", role: "OWNER" })).toThrow(InsufficientFundsError);
    expect(() => s.requestPayout({ businessId: B, payoutId: "Y", potId: pot("OWNER_PROFIT"), amount: R(10), recipientRef: "t", actorId: "m", role: "MANAGER" })).toThrow(PermissionError);
    expect(() => s.requestPayout({ businessId: B, payoutId: "Z", potId: pot("INVENTORY"), amount: R(10), recipientRef: "t", actorId: "a", role: "ACCOUNTANT" })).toThrow(PermissionError);
    const w = s.requestPayout({ businessId: B, payoutId: "W", potId: pot("OWNER_PROFIT"), amount: R(10), recipientRef: "t", actorId: "o", role: "OWNER" });
    expect(w.highRisk).toBe(true);
    expect(() => s.approvePayout({ payoutId: "W", actorId: "o", role: "OWNER", stepUpVerified: false })).toThrow(StepUpRequiredError);
    expect(s.auditLogs.some((a) => a.action === "PAYOUT_REQUESTED")).toBe(true);
    expect(w.simulated).toBe(true);
  });
  it("owner override requires reason + step-up and keeps invariant", () => {
    const { s, pot, pay } = setup(); pay("P1");
    expect(() => s.ownerAdjust({ businessId: B, adjustmentId: "A", from: { potId: pot("OWNER_PROFIT") }, to: { potId: pot("MAINTENANCE") }, amount: R(50), reason: " ", actorId: "o", role: "OWNER", stepUpVerified: true })).toThrow();
    s.ownerAdjust({ businessId: B, adjustmentId: "A", from: { potId: pot("OWNER_PROFIT") }, to: { potId: pot("MAINTENANCE") }, amount: R(50), reason: "seasonal repair", actorId: "o", role: "OWNER", stepUpVerified: true });
    expect(s.getPotBalance(B, pot("MAINTENANCE"))).toBe(R(50)); expect(s.reconcile(B).ok).toBe(true);
  });
});
