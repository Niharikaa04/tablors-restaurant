import { beforeEach, describe, expect, it } from "vitest";
import { Ledger, InsufficientFundsError } from "../ledger";
import { formatINR, rupees } from "../money";
import { selectActiveRules, type AllocationRule } from "../rules";
import { PermissionError, RuleChangeError, StepUpRequiredError } from "../support";
import { DEMO_BUSINESS_ID as B, getPotsRuntime, resetPotsRuntimeForTests } from "../runtime";

const T = new Date("2026-10-03T10:00:00Z");
const OWNER = { id: "owner", role: "OWNER" } as const;
const pot = (t: string) => `${B}:${t}`;
const pay = (ref: string, amount: number, at = T) =>
  getPotsRuntime().payments.handleEvent({ providerEventId: `e-${ref}`, providerRef: ref, businessId: B, billId: `b-${ref}`, amount, status: "SUCCESS", at });
const publish = (key: string, potType: string, method: "PERCENTAGE" | "FIXED" | "MONTHLY_TARGET" | "REMAINING", value: number, extra: Record<string, unknown> = {}) =>
  getPotsRuntime().registry.publish(B, { ruleKey: key, potId: pot(potType), method, value, priority: 1, effectiveFrom: new Date("2026-01-01"), ...extra },
    OWNER, { stepUpVerified: true, reason: "test", at: T });

beforeEach(() => resetPotsRuntimeForTests());

describe("formatINR", () => {
  it("uses Indian grouping, 2dp, handles negatives", () => {
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(118000)).toBe("₹1,180.00");
    expect(formatINR(12345678900)).toBe("₹12,34,56,789.00");
    expect(formatINR(-5)).toBe("-₹0.05");
    expect(() => formatINR(1.5)).toThrow();
    expect(rupees(1180.1)).toBe(118010);
  });
});

describe("ledger invariants", () => {
  it("rejects unbalanced journals, overdrafts, and replays idempotently", () => {
    const l = new Ledger();
    expect(() => l.post(B, "k", "s", [{ account: "SETTLEMENT", amount: -10, sourceType: "PAYMENT_RECEIVED" }, { account: "UNALLOCATED", amount: 9, sourceType: "ALLOCATION" }], "x", T)).toThrow("balance");
    expect(l.post(B, "k1", "s", [{ account: "SETTLEMENT", amount: -10, sourceType: "PAYMENT_RECEIVED" }, { account: "UNALLOCATED", amount: 10, sourceType: "ALLOCATION" }], "x", T)).toBe(true);
    expect(l.post(B, "k1", "s", [{ account: "SETTLEMENT", amount: -10, sourceType: "PAYMENT_RECEIVED" }, { account: "UNALLOCATED", amount: 10, sourceType: "ALLOCATION" }], "x", T)).toBe(false);
    expect(l.merchantFunds(B)).toBe(10);
    expect(() => l.post(B, "k2", "s", [{ account: "UNALLOCATED", amount: -11, sourceType: "TRANSFER" }, { account: "POT:p", amount: 11, sourceType: "TRANSFER" }], "x", T)).toThrow(InsufficientFundsError);
    expect(l.reconcile(B, []).ok).toBe(true);
  });
  it("flags money sitting in an unknown pot", () => {
    const l = new Ledger();
    l.post(B, "k", "s", [{ account: "SETTLEMENT", amount: -10, sourceType: "PAYMENT_RECEIVED" }, { account: "POT:ghost", amount: 10, sourceType: "ALLOCATION" }], "x", T);
    expect(l.reconcile(B, ["real"]).ok).toBe(false);
  });
});

describe("rule registry", () => {
  it("only an owner with step-up and a reason can publish; invalid input writes nothing", () => {
    const rt = getPotsRuntime();
    const base = { ruleKey: "a", potId: pot("GST"), method: "PERCENTAGE" as const, value: 100, priority: 1, effectiveFrom: T };
    expect(() => rt.registry.publish(B, base, { id: "m", role: "MANAGER" }, { stepUpVerified: true, reason: "r", at: T })).toThrow(PermissionError);
    expect(() => rt.registry.publish(B, base, OWNER, { stepUpVerified: false, reason: "r", at: T })).toThrow(StepUpRequiredError);
    expect(() => rt.registry.publish(B, base, OWNER, { stepUpVerified: true, reason: " ", at: T })).toThrow(RuleChangeError);
    expect(() => rt.registry.publish(B, { ...base, floor: 10, cap: 5 }, OWNER, { stepUpVerified: true, reason: "r", at: T })).toThrow(RuleChangeError);
    expect(rt.registry.forBusiness(B)).toHaveLength(0);
  });
  it("a newer disabled version switches the rule OFF (does not fall back to the old one)", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 2000);
    publish("inv", "INVENTORY", "PERCENTAGE", 2000, { enabled: false });
    const rules: AllocationRule[] = getPotsRuntime().registry.forBusiness(B);
    expect(selectActiveRules(rules, B, T)).toHaveLength(0);
    pay("p1", 100000);
    expect(getPotsRuntime().ledger.potBalance(B, pot("INVENTORY"))).toBe(0);
  });
  it("a future-dated version takes over only from its effective date", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 1000);
    publish("inv", "INVENTORY", "PERCENTAGE", 5000, { effectiveFrom: new Date("2026-11-01") });
    pay("now", 100000);
    expect(getPotsRuntime().ledger.potBalance(B, pot("INVENTORY"))).toBe(10000); // v1
    pay("later", 100000, new Date("2026-11-02T00:00:00Z"));
    expect(getPotsRuntime().ledger.potBalance(B, pot("INVENTORY"))).toBe(10000 + 50000); // v2
    expect(getPotsRuntime().ledger.potEntries(B, pot("INVENTORY")).map((e) => e.ruleVersion)).toEqual([1, 2]);
  });
});

describe("payments & refunds", () => {
  it("allocation conserves money across rules, remainder -> profit, funds reconcile", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 2000);
    getPotsRuntime().registry.publish(B, { ruleKey: "profit", potId: pot("OWNER_PROFIT"), method: "REMAINING", value: 0, priority: 99, effectiveFrom: new Date("2026-01-01") }, OWNER, { stepUpVerified: true, reason: "t", at: T });
    pay("p1", 100001);
    const l = getPotsRuntime().ledger;
    expect(l.potBalance(B, pot("INVENTORY"))).toBe(20000);
    expect(l.potBalance(B, pot("OWNER_PROFIT"))).toBe(80001);
    expect(l.unallocated(B)).toBe(0);
    expect(l.reconcile(B, getPotsRuntime().potIds).ok).toBe(true);
  });
  it("duplicate event, same ref re-sent, and failed-then-success are handled once", () => {
    const rt = getPotsRuntime();
    const ev = { providerEventId: "e1", providerRef: "p1", businessId: B, billId: "b", amount: 5000, at: T };
    expect(rt.payments.handleEvent({ ...ev, status: "FAILED" }).outcome).toBe("FAILED_RECORDED");
    expect(rt.payments.handleEvent({ ...ev, status: "FAILED" }).outcome).toBe("DUPLICATE_EVENT");
    expect(rt.payments.handleEvent({ ...ev, providerEventId: "e2", status: "SUCCESS" }).outcome).toBe("ALLOCATED");
    expect(rt.payments.handleEvent({ ...ev, providerEventId: "e3", status: "SUCCESS" }).outcome).toBe("ALREADY_ALLOCATED");
    expect(rt.ledger.merchantFunds(B)).toBe(5000);
  });
  it("full refund returns everything; replay and over-refund are safe", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 3333);
    pay("p1", 100001);
    const rt = getPotsRuntime();
    expect(rt.payments.refund({ refundId: "r1", providerRef: "p1", amount: 100001, actorId: "owner", at: T, reason: "x" }).status).toBe("APPLIED");
    expect(rt.payments.refund({ refundId: "r1", providerRef: "p1", amount: 100001, actorId: "owner", at: T, reason: "x" }).status).toBe("DUPLICATE");
    expect(() => rt.payments.refund({ refundId: "r2", providerRef: "p1", amount: 1, actorId: "owner", at: T, reason: "x" })).toThrow();
    expect(rt.ledger.merchantFunds(B)).toBe(0);
    expect(rt.potIds.every((id) => rt.ledger.potBalance(B, id) === 0)).toBe(true);
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
  });
  it("partial refunds apportion exactly (no paise lost to rounding)", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 3333);
    pay("p1", 100001);
    const rt = getPotsRuntime();
    for (const [i, amt] of [33333, 33333, 33335].entries()) rt.payments.refund({ refundId: `r${i}`, providerRef: "p1", amount: amt, actorId: "owner", at: T, reason: "x" });
    expect(rt.ledger.merchantFunds(B)).toBe(0);
    expect(rt.ledger.reconcile(B, rt.potIds).ok).toBe(true);
  });
  it("refund the pots cannot cover is BLOCKED: nothing written, exception + alert raised", () => {
    publish("inv", "INVENTORY", "PERCENTAGE", 10000);
    pay("p1", 10000);
    const rt = getPotsRuntime();
    // Drain the pot behind the payment service's back (simulates a later payout).
    rt.ledger.post(B, "drain", "x", [{ account: `POT:${pot("INVENTORY")}`, amount: -10000, sourceType: "PAYOUT" }, { account: "SETTLEMENT", amount: 10000, sourceType: "PAYOUT" }], "x", T);
    const before = rt.ledger.entries(B).length;
    const res = rt.payments.refund({ refundId: "r1", providerRef: "p1", amount: 4000, actorId: "owner", at: T, reason: "x" });
    expect(res.status).toBe("BLOCKED");
    expect(rt.ledger.entries(B)).toHaveLength(before);
    expect(rt.payments.exceptions.map((e) => e.code)).toEqual(["REFUND_SHORTFALL"]);
    expect(rt.alerts.list(B).some((a) => a.code === "REFUND_SHORTFALL")).toBe(true);
  });
});
