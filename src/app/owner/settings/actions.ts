"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { saveSettings } from "@/server/modules/demo-store/settings";

export type SettingsActionResult = { ok: true } | { ok: false; error: string };

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");
const GST = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const schema = z.object({
  name: z.string().trim().min(2, "Restaurant name is required").max(100),
  logoDataUrl: z
    .string()
    .max(300_000, "Logo is too large (max ~200 KB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Logo must be PNG, JPG or WebP")
    .nullable(),
  address: z.string().trim().max(300),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || GST.test(v), "Enter a valid 15-character GST number"),
  phone: z.string().trim().refine((v) => v === "" || /^\+?[0-9][0-9\s-]{6,18}$/.test(v), "Enter a valid phone number"),
  email: z.string().trim().refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email"),
  openingTime: time,
  closingTime: time,
  gstRatePercent: z.number().min(0).max(50),
  serviceChargePercent: z.number().min(0).max(30),
  pricesIncludeTax: z.boolean(),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]),
  language: z.enum(["en", "hi", "te"]),
  printer: z.object({
    enabled: z.boolean(),
    paperWidthMm: z.union([z.literal(58), z.literal(80)]),
    autoPrintOnPayment: z.boolean(),
  }),
  kitchen: z.object({
    autoAcceptOrders: z.boolean(),
    defaultPrepMinutes: z.number().int().min(1).max(180),
    soundAlerts: z.boolean(),
  }),
  payment: z
    .object({ cash: z.boolean(), upi: z.boolean(), card: z.boolean(), upiId: z.string().trim().max(60) })
    .refine((p) => p.cash || p.upi || p.card, "Enable at least one payment method")
    .refine((p) => !p.upi || /^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(p.upiId), "Enter a valid UPI ID (e.g. name@bank)"),
});

export async function saveSettingsAction(input: unknown): Promise<SettingsActionResult> {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "settings")) {
    return { ok: false, error: "Only the owner can change restaurant settings." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  saveSettings(session.restaurantId, parsed.data);
  revalidatePath("/owner/settings");
  return { ok: true };
}
