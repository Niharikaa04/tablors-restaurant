"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDemoRole } from "@/server/modules/auth/session";
import { getPotsPinVerified } from "@/server/modules/auth/pots-session";
import { PermissionError, RuleChangeError, type NewRuleInput } from "./support";
import type { AllocationMethod } from "./rules";
import { DEMO_BUSINESS_ID, getPotsRuntime } from "./runtime";

const METHODS: readonly AllocationMethod[] = ["PERCENTAGE", "FIXED", "MONTHLY_TARGET", "REMAINING"];

function back(code: string): never {
  redirect(`/owner/pots/rules?notice=${encodeURIComponent(code)}`);
}
function text(f: FormData, k: string): string {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
}
/** Strict decimal -> number; empty => null; junk => NaN (caller rejects). */
function num(f: FormData, k: string): number | null {
  const t = text(f, k);
  if (t === "") return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}
const toPaise = (r: number) => Math.round(r * 100);

/**
 * Publishes a NEW VERSION of a rule (or a brand-new rule). Never edits an existing row.
 * Guards, all enforced on the server: owner role, PIN-verified session (step-up),
 * mandatory reason, strict validation. The pots PIN gate is the prototype's step-up.
 */
export async function publishRuleAction(formData: FormData): Promise<void> {
  if ((await getDemoRole()) !== "owner") return back("forbidden");
  const stepUpVerified = await getPotsPinVerified();
  if (!stepUpVerified) return back("step-up-required");

  const ruleKey = text(formData, "ruleKey").toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(ruleKey)) return back("invalid-rule-key");
  const potId = text(formData, "potId");
  const method = text(formData, "method") as AllocationMethod;
  if (!METHODS.includes(method)) return back("invalid-method");
  const reason = text(formData, "reason");
  if (!reason) return back("reason-required");

  const rt = getPotsRuntime();
  if (!rt.potIds.includes(potId)) return back("invalid-pot");

  const valueRaw = num(formData, "value");
  if (method !== "REMAINING" && (valueRaw === null || Number.isNaN(valueRaw))) return back("invalid-value");
  const capRaw = num(formData, "capRupees");
  const floorRaw = num(formData, "floorRupees");
  if (Number.isNaN(capRaw) || Number.isNaN(floorRaw)) return back("invalid-cap-floor");
  const priority = Number(text(formData, "priority"));
  if (!Number.isSafeInteger(priority)) return back("invalid-priority");
  const from = text(formData, "effectiveFrom");
  const effectiveFrom = from ? new Date(`${from}T00:00:00+05:30`) : new Date();
  if (Number.isNaN(effectiveFrom.getTime())) return back("invalid-date");

  // PERCENTAGE is entered as a percent (e.g. 12.5) and stored as basis points.
  const value = method === "REMAINING" ? 0 : method === "PERCENTAGE" ? Math.round((valueRaw as number) * 100) : toPaise(valueRaw as number);
  const input: NewRuleInput = {
    ruleKey, potId, method, value, priority,
    cap: capRaw === null ? null : toPaise(capRaw),
    floor: floorRaw === null ? null : toPaise(floorRaw),
    effectiveFrom, enabled: formData.get("enabled") === "on",
  };

  try {
    rt.registry.publish(DEMO_BUSINESS_ID, input, { id: "owner", role: "OWNER" }, { stepUpVerified, reason, at: new Date() });
  } catch (e) {
    if (e instanceof RuleChangeError) return back(`rule-error:${e.message}`);
    if (e instanceof PermissionError) return back("forbidden");
    throw e;
  }
  revalidatePath("/owner/pots");
  revalidatePath("/owner/pots/rules");
  return back("published");
}
