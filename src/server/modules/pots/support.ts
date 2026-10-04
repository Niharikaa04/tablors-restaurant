import type { Paise } from "./money";
import { ruleId, type AllocationMethod, type AllocationRule } from "./rules";

/**
 * Pots supporting pieces: pot definitions, audit log, owner alerts and the
 * versioned rule registry. All in-memory (prototype); the method contracts are
 * what a Postgres-backed implementation must keep.
 *
 * No UPI PIN, bank password or card PIN is accepted or stored anywhere; step-up
 * auth is represented only by a boolean result from an external check.
 */

// ---------- errors ----------
export class PermissionError extends Error {}
export class StepUpRequiredError extends PermissionError {}
/** A rule change was rejected for a business reason (invalid value, missing reason...). */
export class RuleChangeError extends Error {}

// ---------- pots ----------
export type PotType =
  | "GST" | "SALARY" | "INVENTORY" | "MAINTENANCE" | "SUBSCRIPTIONS" | "SERVICE_CHARGES" | "OWNER_PROFIT" | "CUSTOM";

export interface Pot {
  id: string;
  businessId: string;
  type: PotType;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
}

/** Default pot set from the Tablors Pots/Loyalty developer specification. */
export const DEFAULT_POTS: ReadonlyArray<{ type: Exclude<PotType, "CUSTOM">; name: string }> = [
  { type: "GST", name: "GST" },
  { type: "SALARY", name: "Staff Salary" },
  { type: "INVENTORY", name: "Inventory" },
  { type: "MAINTENANCE", name: "Maintenance" },
  { type: "SUBSCRIPTIONS", name: "Subscriptions" },
  { type: "SERVICE_CHARGES", name: "Service Charges" },
  { type: "OWNER_PROFIT", name: "Owner Profit" },
];

/** Pot ids are deterministic: `${businessId}:${TYPE}`. */
export function createDefaultPots(businessId: string): Pot[] {
  return DEFAULT_POTS.map((p) => ({ id: `${businessId}:${p.type}`, businessId, type: p.type, name: p.name, status: "ACTIVE" }));
}

/**
 * Owner-defined Pot such as Rent, Electricity, Marketing or Emergency Reserve (v1.1 §3).
 * Id is `${businessId}:CUSTOM:${slug}`; the owner must be OWNER role.
 */
export function createCustomPot(businessId: string, name: string, existing: readonly Pot[], role: ActorRole): Pot {
  if (role !== "OWNER") throw new PermissionError("only the owner can create a Pot");
  const clean = name.trim();
  if (!clean || clean.length > 40) throw new RuleChangeError("Pot name must be 1-40 characters");
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new RuleChangeError("Pot name needs letters or numbers");
  const id = `${businessId}:CUSTOM:${slug}`;
  if (existing.some((p) => p.id === id || p.name.toLowerCase() === clean.toLowerCase())) throw new RuleChangeError("a Pot with this name already exists");
  return { id, businessId, type: "CUSTOM", name: clean, status: "ACTIVE" };
}

// ---------- audit log ----------
export interface AuditEntry {
  readonly id: string;
  readonly businessId: string;
  readonly actorId: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly reason?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly at: Date;
}

export class AuditLog {
  private rows: AuditEntry[] = [];
  private seq = 0;

  record(e: Omit<AuditEntry, "id">): AuditEntry {
    const row: AuditEntry = Object.freeze({ ...e, id: `aud_${++this.seq}` });
    this.rows.push(row);
    return row;
  }
  list(businessId: string): readonly AuditEntry[] {
    return this.rows.filter((r) => r.businessId === businessId);
  }
}

// ---------- owner alerts ----------
export interface OwnerAlert {
  readonly id: string;
  readonly businessId: string;
  readonly code: string;
  readonly message: string;
  readonly at: Date;
  readonly data?: unknown;
}

export class AlertCenter {
  private rows: OwnerAlert[] = [];
  private seq = 0;

  raise(businessId: string, code: string, message: string, at: Date, data?: unknown): OwnerAlert {
    const row: OwnerAlert = Object.freeze({ id: `alert_${++this.seq}`, businessId, code, message, at, data });
    this.rows.push(row);
    return row;
  }
  list(businessId: string): readonly OwnerAlert[] {
    return this.rows.filter((r) => r.businessId === businessId);
  }
}

// ---------- rule registry ----------
export type ActorRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "STAFF";
export interface RuleActor { id: string; role: ActorRole }

export interface NewRuleInput {
  ruleKey: string;
  potId: string;
  method: AllocationMethod;
  /** PERCENTAGE: basis points. FIXED/MONTHLY_TARGET: paise. REMAINING: 0. */
  value: number;
  priority: number;
  cap?: Paise | null;
  floor?: Paise | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  /** Defaults to true. */
  enabled?: boolean;
}

const METHODS: readonly AllocationMethod[] = ["PERCENTAGE", "FIXED", "MONTHLY_TARGET", "REMAINING"];

function validate(i: NewRuleInput): void {
  const bad = (m: string): never => { throw new RuleChangeError(m); };
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(i.ruleKey)) bad("invalid rule key");
  if (!i.potId) bad("pot is required");
  if (!METHODS.includes(i.method)) bad("invalid method");
  if (!Number.isSafeInteger(i.priority)) bad("priority must be a whole number");
  if (!(i.effectiveFrom instanceof Date) || Number.isNaN(i.effectiveFrom.getTime())) bad("invalid effective date");
  if (i.effectiveTo != null && (Number.isNaN(i.effectiveTo.getTime()) || i.effectiveTo <= i.effectiveFrom)) bad("effective-to must be after effective-from");
  if (i.method !== "REMAINING" && (!Number.isSafeInteger(i.value) || i.value < 0)) bad("value must be a non-negative integer");
  if (i.method === "PERCENTAGE" && i.value > 10000) bad("percentage cannot exceed 100%");
  if (i.cap != null && (!Number.isSafeInteger(i.cap) || i.cap < 0)) bad("invalid cap");
  if (i.floor != null && (!Number.isSafeInteger(i.floor) || i.floor < 0)) bad("invalid floor");
  if (i.cap != null && i.floor != null && i.floor > i.cap) bad("floor cannot exceed cap");
}

/**
 * Append-only registry of versioned allocation rules. A change is ALWAYS a new
 * version (version = previous max + 1); existing rows are never edited, so every
 * ledger entry can point at the exact rule version that produced it.
 */
export class RuleRegistry {
  private rules: AllocationRule[] = [];

  constructor(private audit: AuditLog, private alerts: AlertCenter) {}

  forBusiness(businessId: string): AllocationRule[] {
    return this.rules.filter((r) => r.businessId === businessId);
  }

  publish(
    businessId: string,
    input: NewRuleInput,
    actor: RuleActor,
    ctx: { stepUpVerified: boolean; reason: string; at: Date },
  ): AllocationRule {
    if (actor.role !== "OWNER") throw new PermissionError(`${actor.role} cannot configure allocation rules`);
    if (!ctx.stepUpVerified) throw new StepUpRequiredError("changing allocation rules requires step-up authentication");
    if (!ctx.reason.trim()) throw new RuleChangeError("a reason is required for every rule change");
    validate(input);

    const previous = this.forBusiness(businessId).filter((r) => r.ruleKey === input.ruleKey);
    const latest = previous.reduce<AllocationRule | undefined>((a, b) => (!a || b.version > a.version ? b : a), undefined);
    const version = (latest?.version ?? 0) + 1;
    const rule: AllocationRule = Object.freeze({
      id: ruleId(businessId, input.ruleKey, version),
      ruleKey: input.ruleKey, version, businessId,
      potId: input.potId, method: input.method,
      value: input.method === "REMAINING" ? 0 : input.value,
      priority: input.priority,
      cap: input.cap ?? null, floor: input.floor ?? null,
      effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null,
      enabled: input.enabled ?? true,
    });
    this.rules.push(rule);
    this.audit.record({
      businessId, actorId: actor.id, action: "RULE_PUBLISHED", entity: "allocation_rule", entityId: rule.id,
      reason: ctx.reason.trim(), before: latest, after: rule, at: ctx.at,
    });
    this.alerts.raise(businessId, "RULE_CHANGED", `Rule ${rule.ruleKey} is now v${rule.version}`, ctx.at);
    return rule;
  }
}
