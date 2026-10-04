"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { getDevices } from "@/server/modules/demo-store/store";
import { addDevices, changePlan, renew } from "@/server/modules/demo-store/subscription";

export type SubscriptionActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): SubscriptionActionResult => ({ ok: false, error });

async function authorize() {
  const session = await getDemoSession();
  return session && hasPermission(session.role, "subscription") ? session : null;
}
const done = (): SubscriptionActionResult => {
  revalidatePath("/owner/subscription");
  return { ok: true };
};

// NOTE: demo only. In production, call your payment gateway first and only
// change the plan after the payment webhook confirms success.
export async function changePlanAction(plan: unknown): Promise<SubscriptionActionResult> {
  const session = await authorize();
  if (!session) return fail("Only the owner can change the subscription.");
  const p = z.enum(["starter", "professional", "enterprise"]).safeParse(plan);
  if (!p.success) return fail("Invalid plan.");
  const err = changePlan(session.restaurantId, p.data, getDevices().length);
  return err ? fail(err) : done();
}

export async function renewAction(): Promise<SubscriptionActionResult> {
  const session = await authorize();
  if (!session) return fail("Only the owner can renew.");
  renew(session.restaurantId);
  return done();
}

export async function addDevicesAction(count: unknown): Promise<SubscriptionActionResult> {
  const session = await authorize();
  if (!session) return fail("Only the owner can add devices.");
  const p = z.coerce.number().int().min(1, "Enter at least 1").max(100).safeParse(count);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid number");
  addDevices(session.restaurantId, p.data);
  return done();
}
