"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import {
  createOffer,
  queueOfferMessages,
  recordVisit,
  setOfferActive,
} from "@/server/modules/loyalty/store";

async function authorize() {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "loyalty")) {
    redirect("/owner/loyalty?notice=denied");
  }
  return session;
}

const offerSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    kind: z.enum(["fixed", "percent"]),
    value: z.coerce.number().int().min(1).max(100000),
    minBillRupees: z.coerce.number().int().min(0).max(100000),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((o) => o.kind !== "percent" || o.value <= 100, "percent")
  .refine((o) => o.startsOn <= o.endsOn, "dates");

export async function createOfferAction(formData: FormData) {
  const session = await authorize();
  const parsed = offerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/owner/loyalty?notice=invalid-offer");
  createOffer(session.restaurantId, parsed.data);
  revalidatePath("/owner/loyalty");
  redirect("/owner/loyalty?notice=offer-created");
}

export async function toggleOfferAction(formData: FormData) {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  setOfferActive(session.restaurantId, id, formData.get("active") === "true");
  revalidatePath("/owner/loyalty");
}

export async function sendOfferAction(formData: FormData) {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  const name = getSettings(session.restaurantId).name;
  const n = queueOfferMessages(session.restaurantId, id, name);
  revalidatePath("/owner/loyalty");
  redirect(`/owner/loyalty?notice=queued-${n}`);
}

/** Test helper: add a visit by hand until the customer screen is wired. */
export async function addTestVisitAction(formData: FormData) {
  const session = await authorize();
  const res = recordVisit(session.restaurantId, {
    phone: String(formData.get("phone") ?? ""),
    orderTotalRupees: Number(formData.get("total") ?? 0),
    consent: formData.get("consent") === "on",
  });
  revalidatePath("/owner/loyalty");
  redirect(`/owner/loyalty?notice=${res.ok ? "visit-added" : "invalid-phone"}`);
}