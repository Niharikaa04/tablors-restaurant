import { describe, it, expect } from "vitest";
import { allocate, type PotRule } from "../allocation-engine";
import { rupees as R } from "../money";

const at = new Date("2026-10-05T10:00:00Z");
let n = 0;
const rule = (o: Partial<PotRule> & Pick<PotRule, "potId" | "method" | "value">): PotRule => ({
  ruleKey: `r${++n}`, version: 1, businessId: "b", priority: n, effectiveFrom: new Date("2026-01-01"), enabled: true, ...o,
});
const sum = (r: ReturnType<typeof allocate>) => r.lines.reduce((a, l) => a + l.amount, 0);

describe("allocation engine (pure)", () => {
  it("percentage (bps) allocation, remainder -> profit, totals conserve", () => {
    const r = allocate({ eligible: R(1000), at, rules: [
      rule({ potId: "inv", method: "PERCENTAGE", value: 2000, priority: 1 }),
      rule({ potId: "profit", method: "REMAINING", value: 0, priority: 99 }),
    ] });
    expect(r.lines.map((l) => [l.potId, l.amount])).toEqual([["inv", R(200)], ["profit", R(800)]]);
    expect(r.unallocated).toBe(0);
  });
  it("fixed allocation", () => {
    const r = allocate({ eligible: R(1000), at, rules: [rule({ potId: "m", method: "FIXED", value: R(50) })] });
    expect(sum(r)).toBe(R(50)); expect(r.unallocated).toBe(R(950));
  });
  it("monthly target stops once the month-to-date target is met", () => {
    const rules = [rule({ potId: "sal", method: "MONTHLY_TARGET", value: R(60000) })];
    expect(sum(allocate({ eligible: R(1000), at, rules, monthToDateByPot: { sal: R(59800) } }))).toBe(R(200));
    expect(sum(allocate({ eligible: R(1000), at, rules, monthToDateByPot: { sal: R(60000) } }))).toBe(0);
  });
  it("insufficient funds: partial allocation, alert, never over-allocates", () => {
    const r = allocate({ eligible: R(100), at, rules: [rule({ potId: "a", method: "FIXED", value: R(150) })] });
    expect(sum(r)).toBe(R(100)); expect(r.alerts.some((a) => a.code === "INSUFFICIENT_FUNDS" && a.shortfall === R(50))).toBe(true);
  });
  it("cap and floor", () => {
    expect(sum(allocate({ eligible: R(1000), at, rules: [rule({ potId: "a", method: "PERCENTAGE", value: 5000, cap: R(100) })] }))).toBe(R(100));
    expect(sum(allocate({ eligible: R(100), at, rules: [rule({ potId: "a", method: "PERCENTAGE", value: 1000, floor: R(30) })] }))).toBe(R(30));
  });
  it("priority decides who is starved when funds are short", () => {
    const r = allocate({ eligible: R(100), at, rules: [
      rule({ potId: "late", method: "FIXED", value: R(80), priority: 2 }),
      rule({ potId: "early", method: "FIXED", value: R(80), priority: 1 }),
    ] });
    expect(r.lines.map((l) => [l.potId, l.amount])).toEqual([["early", R(80)], ["late", R(20)]]);
  });
  it("disabled and out-of-window rules are ignored", () => {
    const r = allocate({ eligible: R(100), at, rules: [
      rule({ potId: "x", method: "FIXED", value: R(10), enabled: false }),
      rule({ potId: "y", method: "FIXED", value: R(10), effectiveFrom: new Date("2027-01-01") }),
      rule({ potId: "z", method: "FIXED", value: R(10), effectiveTo: new Date("2026-02-01") }),
    ] });
    expect(r.lines).toHaveLength(0); expect(r.unallocated).toBe(R(100));
  });
  it("highest active version of a ruleKey wins and lines carry the version", () => {
    const r = allocate({ eligible: R(100), at, rules: [
      rule({ ruleKey: "k", version: 1, potId: "a", method: "FIXED", value: R(10) }),
      rule({ ruleKey: "k", version: 2, potId: "a", method: "FIXED", value: R(20) }),
    ] });
    expect(r.lines).toEqual([expect.objectContaining({ amount: R(20), ruleVersion: 2 })]);
  });
  it("invalid rules are skipped with an alert, never create money", () => {
    const r = allocate({ eligible: R(100), at, rules: [rule({ potId: "a", method: "FIXED", value: -5 }), rule({ potId: "b", method: "PERCENTAGE", value: 20000 })] });
    expect(r.lines).toHaveLength(0); expect(r.alerts.filter((a) => a.code === "INVALID_RULE")).toHaveLength(2);
  });
  it("allocated total can never exceed eligible (many rules)", () => {
    const rules = Array.from({ length: 12 }, (_, i) => rule({ potId: `p${i}`, method: "PERCENTAGE", value: 1500, priority: i }));
    const r = allocate({ eligible: R(1180), at, rules });
    expect(sum(r)).toBeLessThanOrEqual(R(1180)); expect(sum(r) + r.unallocated).toBe(R(1180));
  });
});
