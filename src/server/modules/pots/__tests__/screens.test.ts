import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: null as string | null, pin: false }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("@/server/modules/auth/session", () => ({ getDemoRole: async () => session.role }));
vi.mock("@/server/modules/auth/pots-session", () => ({ getPotsPinVerified: async () => session.pin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));

import { DEMO_BUSINESS_ID as B, getPotsRuntime, resetPotsRuntimeForTests } from "../runtime";
import { buildDashboard, buildPotView, buildRulesView, istDayBounds, potSlug } from "../views";
import { publishRuleAction } from "../rule-actions";

const T = new Date("2026-10-03T10:00:00Z");
const pay = (ref: string, amount: number) => getPotsRuntime().payments.handleEvent({
  providerEventId: `e-${ref}`, providerRef: ref, businessId: B, billId: `bill-${ref}`, amount, status: "SUCCESS", at: T,
});
function form(v: Record<string, string>) {
  const f = new FormData();
  const d: Record<string, string> = { ruleKey: "inventory", potId: `${B}:INVENTORY`, method: "PERCENTAGE", value: "20", priority: "1", reason: "initial setup", effectiveFrom: "2026-01-01", enabled: "on", ...v };
  for (const [k, val] of Object.entries(d)) if (val !== "__omit__") f.set(k, val);
  return f;
}
const last = () => String(nav.redirect.mock.calls.at(-1)?.[0] ?? "");

beforeEach(() => { resetPotsRuntimeForTests(); session.role = "owner"; session.pin = true; nav.redirect.mockClear(); });

describe("dashboard view (ledger-derived)", () => {
  it("empty runtime: all zero, reconciled, no rules, 7 default pots, nothing hard-coded", () => {
    const d = buildDashboard(getPotsRuntime(), T);
    expect(d.totals).toEqual({ totalSettledBalance: 0, collectedToday: 0, allocatedToPots: 0, unallocated: 0 });
    expect(d.reconciliation.ok).toBe(true); expect(d.hasAnyRule).toBe(false);
    expect(d.cards.map((c) => c.slug)).toEqual(["gst", "salary", "inventory", "maintenance", "subscriptions", "service-charges", "owner-profit"]);
    expect(d.cards.every((c) => c.balance === 0 && c.status === "NO_RULE")).toBe(true);
  });
  it("no rules: payment shows as unallocated; totals reconcile", () => {
    pay("p1", 118000);
    const d = buildDashboard(getPotsRuntime(), T);
    expect(d.totals).toMatchObject({ totalSettledBalance: 118000, collectedToday: 118000, allocatedToPots: 0, unallocated: 118000 });
    expect(d.reconciliation.ok).toBe(true);
  });
  it("'today' is the IST day", () => {
    const [from, to] = istDayBounds(new Date("2026-10-03T19:00:00Z")); // 00:30 IST on 4 Oct
    expect(from.toISOString()).toBe("2026-10-03T18:30:00.000Z"); expect(to.getTime() - from.getTime()).toBe(86_400_000);
  });
});

describe("rules action (owner + PIN + reason, versioned)", () => {
  it("rejects non-owner, missing PIN session, missing reason, bad values, bad pot", async () => {
    session.role = "kitchen"; await publishRuleAction(form({})); expect(last()).toContain("forbidden");
    session.role = "owner"; session.pin = false; await publishRuleAction(form({})); expect(last()).toContain("step-up-required");
    session.pin = true;
    await publishRuleAction(form({ reason: " " })); expect(last()).toContain("reason-required");
    await publishRuleAction(form({ value: "abc" })); expect(last()).toContain("invalid-value");
    await publishRuleAction(form({ value: "150" })); expect(last()).toContain("rule-error"); // >100%
    await publishRuleAction(form({ potId: "nope" })); expect(last()).toContain("invalid-pot");
    await publishRuleAction(form({ ruleKey: "Bad Key!" })); expect(last()).toContain("invalid-rule-key");
    expect(getPotsRuntime().registry.forBusiness(B)).toHaveLength(0);
  });
  it("publishes v1 then v2; stores bps/paise; history and audit kept", async () => {
    await publishRuleAction(form({ value: "12.5", capRupees: "500" }));
    expect(last()).toContain("notice=published");
    let r = getPotsRuntime().registry.forBusiness(B);
    expect(r[0]).toMatchObject({ version: 1, method: "PERCENTAGE", value: 1250, cap: 50000 });
    await publishRuleAction(form({ value: "20", reason: "raised" }));
    r = getPotsRuntime().registry.forBusiness(B);
    expect(r.map((x) => x.version)).toEqual([1, 2]); expect(r[0]?.value).toBe(1250); // v1 untouched
    expect(getPotsRuntime().audit.list(B).filter((a) => a.action === "RULE_PUBLISHED")).toHaveLength(2);
    expect(buildRulesView(getPotsRuntime()).versionsByKey["inventory"]).toBe(2);
  });
  it("fixed/monthly use rupees->paise; REMAINING ignores value", async () => {
    await publishRuleAction(form({ ruleKey: "sal", potId: `${B}:SALARY`, method: "MONTHLY_TARGET", value: "60000", priority: "2" }));
    await publishRuleAction(form({ ruleKey: "profit", potId: `${B}:OWNER_PROFIT`, method: "REMAINING", value: "__omit__", priority: "99" }));
    const r = getPotsRuntime().registry.forBusiness(B);
    expect(r.find((x) => x.ruleKey === "sal")?.value).toBe(6000000);
    expect(r.find((x) => x.ruleKey === "profit")).toMatchObject({ method: "REMAINING", value: 0 });
  });
});

describe("pot detail explains the balance", () => {
  it("allocation, then refund reversal appear as ledger rows with running balances; old rows keep rule version", async () => {
    await publishRuleAction(form({ value: "20" }));
    pay("p1", 100000); // ₹1000 -> ₹200 inventory
    const rt = getPotsRuntime();
    rt.payments.refund({ refundId: "r1", providerRef: "p1", amount: 50000, actorId: "owner", at: T, reason: "complaint" });
    const v = buildPotView(rt, "inventory", T)!;
    expect(v.card.balance).toBe(10000);
    expect(v.transactions.map((t) => [t.label, t.amount, t.balanceAfter])).toEqual([["Refund reversal", -10000, 10000], ["Payment allocation", 20000, 20000]]);
    expect(v.transactions[1]?.ruleVersion).toBe(1);
    expect(buildPotView(rt, "nonexistent")).toBeNull();
    expect(potSlug(rt.pots.find((p) => p.type === "OWNER_PROFIT")!)).toBe("owner-profit");
    expect(buildDashboard(rt, T).reconciliation.ok).toBe(true);
  });
  it("monthly target card shows progress from ledger, status flips to target met", async () => {
    await publishRuleAction(form({ ruleKey: "sal", potId: `${B}:SALARY`, method: "MONTHLY_TARGET", value: "300", priority: "1" }));
    pay("p1", 10000); // ₹100 of ₹300
    let c = buildDashboard(getPotsRuntime(), T).cards.find((x) => x.slug === "salary")!;
    expect([c.progressPercent, c.status]).toEqual([33, "COLLECTING"]);
    pay("p2", 50000);
    c = buildDashboard(getPotsRuntime(), T).cards.find((x) => x.slug === "salary")!;
    expect([c.balance, c.progressPercent, c.status]).toEqual([30000, 100, "TARGET_MET"]);
  });
});
