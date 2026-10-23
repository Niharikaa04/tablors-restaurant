"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import { notify } from "@/server/modules/notifications/store";
import {
  createOffer,
  maskPhone,
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
  await createOffer(session.restaurantId, parsed.data);
  revalidatePath("/owner/loyalty");
  redirect("/owner/loyalty?notice=offer-created");
}

export async function toggleOfferAction(formData: FormData) {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  await setOfferActive(session.restaurantId, id, formData.get("active") === "true");
  revalidatePath("/owner/loyalty");
}

export async function sendOfferAction(formData: FormData) {
  const session = await authorize();
  const id = String(formData.get("id") ?? "");
  const name = (await getSettings(session.restaurantId)).name;
  const n = await queueOfferMessages(session.restaurantId, id, name);
  revalidatePath("/owner/loyalty");
  redirect(`/owner/loyalty?notice=queued-${n}`);
}

/** Test helper: add a visit by hand until the customer screen is wired. */
export async function addTestVisitAction(formData: FormData) {
  const session = await authorize();
  const res = await recordVisit(session.restaurantId, {
    phone: String(formData.get("phone") ?? ""),
    orderTotalRupees: Number(formData.get("total") ?? 0),
    consent: formData.get("consent") === "on",
  });
  if (res.ok) {
    try {
      await notify({
        type: "LOYALTY_POINTS_EARNED",
        title: "Loyalty visit recorded",
        message: `Member ${maskPhone(res.member.phone)} now has ${res.member.points} points.`,
      });
    } catch (error) {
      console.error("Loyalty notification failed", error);
    }
  }
  revalidatePath("/owner/loyalty");
  redirect(`/owner/loyalty?notice=${res.ok ? "visit-added" : "invalid-phone"}`);
}