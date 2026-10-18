"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import {
  adjustPointsDb,
  createRewardDb,
  saveLoyaltySettingsDb,
  setCustomerStatusDb,
  setRewardActiveDb,
  updateRewardDb,
  type RewardInput,
} from "@/server/modules/loyalty-db/db-loyalty";

const BASE = "/owner/loyalty";

async function authorize() {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "loyalty")) redirect(`${BASE}?notice=denied`);
  return session;
}

function done(notice: string, extra = ""): never {
  revalidatePath(BASE);
  redirect(`${BASE}?notice=${notice}${extra}`);
}

const optInt = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(0).nullable());
const checkbox = (v: FormDataEntryValue | null) => v === "on" || v === "true";

const settingsSchema = z.object({
  earnSpendRupees: z.coerce.number().min(1).max(100000),
  earnPoints: z.coerce.number().int().min(1).max(1000),
  minBillRupees: z.coerce.number().min(0).max(1000000),
  maxPointsPerBill: optInt,
  expiryMonths: optInt,
  minPointsToRedeem: z.coerce.number().int().min(0).max(1000000),
});

export async function saveLoyaltySettingsAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const parsed = settingsSchema.safeParse({
    earnSpendRupees: formData.get("earnSpendRupees"),
    earnPoints: formData.get("earnPoints"),
    minBillRupees: formData.get("minBillRupees") || 0,
    maxPointsPerBill: formData.get("maxPointsPerBill"),
    expiryMonths: formData.get("expiryMonths"),
    minPointsToRedeem: formData.get("minPointsToRedeem") || 0,
  });
  if (!parsed.success) done("invalid-settings");

  const d = parsed.data;
  await saveLoyaltySettingsDb(session.restaurantId, {
    enabled: checkbox(formData.get("enabled")),
    earnSpendPaise: Math.round(d.earnSpendRupees * 100),
    earnPoints: d.earnPoints,
    excludeGst: checkbox(formData.get("excludeGst")),
    excludeServiceCharge: checkbox(formData.get("excludeServiceCharge")),
    discountBeforePoints: checkbox(formData.get("discountBeforePoints")),
    minBillPaise: Math.round(d.minBillRupees * 100),
    maxPointsPerBill: d.maxPointsPerBill,
    expiryMonths: d.expiryMonths,
    minPointsToRedeem: d.minPointsToRedeem,
  });
  done("settings-saved");
}

const rewardSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    type: z.enum(["fixed_discount", "percent_discount", "free_item", "coupon", "experience"]),
    pointsCost: z.coerce.number().int().min(1).max(10000000),
    valueRupees: optInt,
    percent: optInt,
    maxDiscountRupees: optInt,
    quantity: optInt,
    terms: z.string().trim().max(300).optional(),
  })
  .refine((r) => r.type !== "fixed_discount" || (r.valueRupees ?? 0) > 0, { path: ["valueRupees"] })
  .refine((r) => r.type !== "percent_discount" || ((r.percent ?? 0) > 0 && (r.percent ?? 0) <= 100), { path: ["percent"] });

function readReward(formData: FormData): RewardInput | null {
  const parsed = rewardSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    pointsCost: formData.get("pointsCost"),
    valueRupees: formData.get("valueRupees"),
    percent: formData.get("percent"),
    maxDiscountRupees: formData.get("maxDiscountRupees"),
    quantity: formData.get("quantity"),
    terms: formData.get("terms") ?? undefined,
  });
  if (!parsed.success) return null;
  const d = parsed.data;
  const from = String(formData.get("validFrom") ?? "");
  const to = String(formData.get("validTo") ?? "");
  return {
    name: d.name,
    type: d.type,
    pointsCost: d.pointsCost,
    valuePaise: d.type === "fixed_discount" && d.valueRupees ? d.valueRupees * 100 : null,
    percent: d.type === "percent_discount" ? d.percent : null,
    maxDiscountPaise: d.type === "percent_discount" && d.maxDiscountRupees ? d.maxDiscountRupees * 100 : null,
    quantity: d.quantity,
    terms: d.terms ? d.terms : null,
    validFrom: from ? new Date(`${from}T00:00:00+05:30`) : null,
    validTo: to ? new Date(`${to}T23:59:59+05:30`) : null,
  };
}

export async function createRewardAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const input = readReward(formData);
  if (!input) done("invalid-reward");
  await createRewardDb(session.restaurantId, input);
  done("reward-created");
}

export async function updateRewardAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  const input = readReward(formData);
  if (!id || !input) done("invalid-reward");
  await updateRewardDb(session.restaurantId, id, input);
  done("reward-updated");
}

export async function toggleRewardAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  if (id) await setRewardActiveDb(session.restaurantId, id, formData.get("active") === "true");
  done("reward-updated");
}

/** Manual adjustments are owner-only, need a reason and are always logged with the actor. */
export async function adjustPointsAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const customerId = String(formData.get("customerId") ?? "");
  if (session.role !== "owner") done("owner-only", `&customer=${customerId}`);

  const points = Number(formData.get("points"));
  const reason = String(formData.get("reason") ?? "");
  const requestId = String(formData.get("requestId") ?? randomUUID());
  const res = await adjustPointsDb(session.restaurantId, customerId, points, reason, `owner:${session.role}`, requestId);
  done(res.ok ? "adjusted" : "adjust-failed", `&customer=${customerId}`);
}

export async function setCustomerStatusAction(formData: FormData): Promise<void> {
  const session = await authorize();
  const customerId = String(formData.get("customerId") ?? "");
  const status = formData.get("status") === "blocked" ? "blocked" : "active";
  if (customerId) await setCustomerStatusDb(session.restaurantId, customerId, status);
  done("customer-updated", `&customer=${customerId}`);
}
