import { assertPaise, bpsOf, type Paise } from "./money";

/**
 * Allocation rules + the pure allocation engine (Pots spec §6, §7).
 * No I/O, no clock, no state. It never decides business percentages:
 * every number comes from owner-published rules.
 *
 * `allocate` is the existing financial-pots engine, moved here unchanged in
 * behaviour (only widened so `cap`/`floor` may be `null`, as the rules form
 * stores "no cap" as null). financial-pots/core/allocation-engine.ts re-exports it.
 */
export type AllocationMethod = "PERCENTAGE" | "FIXED" | "MONTHLY_TARGET" | "REMAINING";

/** Engine view of a rule (no storage id). */
export interface PotRuleBase {
  /** Stable logical identity across versions. */
  ruleKey: string;
  /** Immutable once created; edits create version+1. */
  version: number;
  businessId: string;
  potId: string;
  method: AllocationMethod;
  /** PERCENTAGE: basis points (1800 = 18%). FIXED/MONTHLY_TARGET: paise. REMAINING: ignored. */
  value: number;
  priority: number; // lower runs first
  /** Max paise this rule may allocate per payment. null/undefined = no cap. */
  cap?: Paise | null;
  /** Min paise requested per payment when the rule yields > 0. null/undefined = no floor. */
  floor?: Paise | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  enabled: boolean;
}

/** A stored, versioned rule. `id` = `${businessId}:${ruleKey}:${version}`. */
export interface AllocationRule extends PotRuleBase {
  readonly id: string;
}

export interface AllocationLine {
  potId: string;
  amount: Paise;
  method: AllocationMethod;
  ruleKey: string;
  ruleVersion: number;
}

export type AllocationAlertCode =
  | "INSUFFICIENT_FUNDS" // rule wanted more than was left
  | "INVALID_RULE"
  | "UNALLOCATED_REMAINDER";

export interface AllocationAlert {
  code: AllocationAlertCode;
  potId?: string;
  ruleKey?: string;
  shortfall?: Paise;
  message: string;
}

export interface AllocationResult {
  lines: AllocationLine[];
  allocated: Paise;
  unallocated: Paise;
  alerts: AllocationAlert[];
}

export function ruleId(businessId: string, ruleKey: string, version: number): string {
  return `${businessId}:${ruleKey}:${version}`;
}

export function isRuleActive(r: PotRuleBase, at: Date): boolean {
  return r.enabled && at >= r.effectiveFrom && (r.effectiveTo == null || at < r.effectiveTo);
}

/** Rules in force at `at`; if several versions of a ruleKey overlap, the highest version wins. */
export function activeRules<R extends PotRuleBase>(rules: R[], at: Date): R[] {
  const best = new Map<string, R>();
  for (const r of rules) {
    if (!isRuleActive(r, at)) continue;
    const cur = best.get(r.ruleKey);
    if (!cur || r.version > cur.version) best.set(r.ruleKey, r);
  }
  return [...best.values()].sort((a, b) => a.priority - b.priority || a.ruleKey.localeCompare(b.ruleKey));
}

/**
 * The rules that govern `businessId` at time `at`, as stored by the RuleRegistry.
 * For each ruleKey the governing version is the HIGHEST version already in effect
 * (effectiveFrom <= at < effectiveTo). It is then in force only if that version is
 * enabled — so publishing a new, disabled version switches the rule off instead of
 * silently falling back to an older enabled version.
 */
export function selectActiveRules<R extends PotRuleBase>(rules: readonly R[], businessId: string, at: Date): R[] {
  const governing = new Map<string, R>();
  for (const r of rules) {
    if (r.businessId !== businessId) continue;
    if (at < r.effectiveFrom || (r.effectiveTo != null && at >= r.effectiveTo)) continue;
    const cur = governing.get(r.ruleKey);
    if (!cur || r.version > cur.version) governing.set(r.ruleKey, r);
  }
  return [...governing.values()]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority || a.ruleKey.localeCompare(b.ruleKey));
}

export function allocate(input: {
  eligible: Paise;
  rules: PotRuleBase[];
  at: Date;
  /** Net amount already allocated to each pot in the current month (for MONTHLY_TARGET). */
  monthToDateByPot?: Record<string, Paise>;
}): AllocationResult {
  const { eligible, at } = input;
  assertPaise(eligible, "eligible");
  if (eligible < 0) throw new Error("eligible must be >= 0");
  const mtd = { ...(input.monthToDateByPot ?? {}) };

  const lines: AllocationLine[] = [];
  const alerts: AllocationAlert[] = [];
  let remaining = eligible;

  for (const r of activeRules(input.rules, at)) {
    const bad = (m: string) => alerts.push({ code: "INVALID_RULE", potId: r.potId, ruleKey: r.ruleKey, message: m });
    const cap = r.cap ?? undefined;
    const floor = r.floor ?? undefined;
    if (r.method !== "REMAINING" && (!Number.isSafeInteger(r.value) || r.value < 0)) { bad("value must be a non-negative integer"); continue; }
    if (r.method === "PERCENTAGE" && r.value > 10000) { bad("percentage above 100%"); continue; }
    if (cap !== undefined && (!Number.isSafeInteger(cap) || cap < 0)) { bad("invalid cap"); continue; }
    if (floor !== undefined && (!Number.isSafeInteger(floor) || floor < 0)) { bad("invalid floor"); continue; }
    if (cap !== undefined && floor !== undefined && floor > cap) { bad("floor greater than cap"); continue; }

    let want: Paise;
    switch (r.method) {
      case "PERCENTAGE": want = bpsOf(eligible, r.value); break;
      case "FIXED": want = r.value; break;
      case "MONTHLY_TARGET": want = Math.max(0, r.value - (mtd[r.potId] ?? 0)); break;
      case "REMAINING": want = remaining; break;
      default: bad("unknown method"); continue;
    }
    if (want > 0 && floor !== undefined) want = Math.max(want, floor);
    if (cap !== undefined) want = Math.min(want, cap);

    const grant = Math.min(want, remaining);
    if (grant < want) {
      alerts.push({
        code: "INSUFFICIENT_FUNDS", potId: r.potId, ruleKey: r.ruleKey, shortfall: want - grant,
        message: `Rule ${r.ruleKey} wanted ${want} paise but only ${grant} was available`,
      });
    }
    if (grant > 0) {
      lines.push({ potId: r.potId, amount: grant, method: r.method, ruleKey: r.ruleKey, ruleVersion: r.version });
      remaining -= grant;
      mtd[r.potId] = (mtd[r.potId] ?? 0) + grant;
    }
  }

  const allocated = eligible - remaining;
  if (remaining > 0) {
    alerts.push({ code: "UNALLOCATED_REMAINDER", shortfall: remaining, message: `${remaining} paise left unallocated` });
  }
  // Conservation: never create or lose money.
  const sum = lines.reduce((a, l) => a + l.amount, 0);
  if (sum + remaining !== eligible || sum !== allocated || sum > eligible) throw new Error("allocation conservation violated");
  return { lines, allocated, unallocated: remaining, alerts };
}
