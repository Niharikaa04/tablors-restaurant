"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/server/modules/auth/session";
import {
  createOffer,
  deleteOffer,
  setOfferActive,
  updateOffer,
  type OfferType,
  type OfferTargetType,
} from "@/server/modules/offers/store";
import {
  getMenuItemById,
  getMenu,
} from "@/server/modules/demo-store/store";

const OfferSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Offer name must contain at least 2 characters.")
    .max(80, "Offer name is too long."),

  description: z
    .string()
    .trim()
    .max(240, "Description is too long."),

  type: z.enum([
    "fixed_price",
    "percentage",
    "buy_x_get_y",
  ]),

  targetType: z.enum([
    "item",
    "category",
    "order",
  ]),

  targetItemId: z.string().nullable(),
  targetCategory: z.string().nullable(),

  fixedPriceRupees: z.number().int().nonnegative().nullable(),

  percentagePercent: z
    .number()
    .int()
    .min(1)
    .max(100)
    .nullable(),

  buyQuantity: z
    .number()
    .int()
    .min(1)
    .max(100)
    .nullable(),

  freeQuantity: z
    .number()
    .int()
    .min(1)
    .max(100)
    .nullable(),

  minimumOrderRupees: z
    .number()
    .int()
    .nonnegative()
    .nullable(),

  startsAt: z.number().int().positive(),
  endsAt: z.number().int().positive(),

  active: z.boolean(),
});

function parseNullableNumber(
  value: FormDataEntryValue | null
): number | null {
  if (value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

function parseBoolean(
  value: FormDataEntryValue | null
): boolean {
  return String(value) === "true";
}

function parseFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),

    type: String(formData.get("type") ?? "") as OfferType,

    targetType: String(
      formData.get("targetType") ?? ""
    ) as OfferTargetType,

    targetItemId:
      String(formData.get("targetItemId") ?? "").trim() || null,

    targetCategory:
      String(formData.get("targetCategory") ?? "").trim() || null,

    fixedPriceRupees: parseNullableNumber(
      formData.get("fixedPriceRupees")
    ),

    percentagePercent: parseNullableNumber(
      formData.get("percentagePercent")
    ),

    buyQuantity: parseNullableNumber(
      formData.get("buyQuantity")
    ),

    freeQuantity: parseNullableNumber(
      formData.get("freeQuantity")
    ),

    minimumOrderRupees: parseNullableNumber(
      formData.get("minimumOrderRupees")
    ),

    startsAt: Number(formData.get("startsAt")),
    endsAt: Number(formData.get("endsAt")),

    active: parseBoolean(formData.get("active")),
  };
}

function validateBusinessRules(input: {
  type: OfferType;
  targetType: OfferTargetType;
  targetItemId: string | null;
  targetCategory: string | null;
  fixedPriceRupees: number | null;
  percentagePercent: number | null;
  buyQuantity: number | null;
  freeQuantity: number | null;
  minimumOrderRupees: number | null;
  startsAt: number;
  endsAt: number;
}) {
  if (input.endsAt <= input.startsAt) {
    return "Offer end time must be after the start time.";
  }

  if (input.type === "fixed_price") {
    if (input.fixedPriceRupees === null) {
      return "Enter the promotional price.";
    }

    if (input.fixedPriceRupees < 0) {
      return "Promotional price cannot be negative.";
    }

    if (input.targetType === "order") {
      return "Fixed-price offers must target an item or category.";
    }
  }

  if (input.type === "percentage") {
    if (input.percentagePercent === null) {
      return "Enter a percentage.";
    }

    if (input.percentagePercent < 1) {
      return "Percentage must be at least 1%.";
    }
  }

  if (input.type === "buy_x_get_y") {
    if (
      input.buyQuantity === null ||
      input.freeQuantity === null
    ) {
      return "Enter both Buy and Get quantities.";
    }

    if (input.targetType === "order") {
      return "Buy X Get Y must target an item or category.";
    }
  }

  if (input.targetType === "item") {
    if (!input.targetItemId) {
      return "Select a menu item.";
    }

    const item = getMenuItemById(input.targetItemId);

    if (!item) {
      return "Selected menu item was not found.";
    }
  }

  if (input.targetType === "category") {
    if (!input.targetCategory) {
      return "Select a category.";
    }

    const categoryExists = getMenu().some(
      (item) => item.category === input.targetCategory
    );

    if (!categoryExists) {
      return "Selected category was not found.";
    }
  }

  if (input.targetType === "order") {
    if (
      input.minimumOrderRupees === null ||
      input.minimumOrderRupees < 0
    ) {
      return "Enter a valid minimum order value.";
    }
  }

  return null;
}

export async function createOfferAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requirePermission("offers");

  const raw = parseFormData(formData);

  const parsed = OfferSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Invalid offer details.",
    };
  }

  const businessError = validateBusinessRules(parsed.data);

  if (businessError) {
    return {
      ok: false,
      message: businessError,
    };
  }

  createOffer(parsed.data);

  revalidatePath("/owner/offers");

  return {
    ok: true,
    message: "Offer created successfully.",
  };
}

export async function updateOfferAction(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  await requirePermission("offers");

  const raw = parseFormData(formData);

  const parsed = OfferSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Invalid offer details.",
    };
  }

  const businessError = validateBusinessRules(parsed.data);

  if (businessError) {
    return {
      ok: false,
      message: businessError,
    };
  }

  const updated = updateOffer(id, parsed.data);

  if (!updated) {
    return {
      ok: false,
      message: "Offer not found.",
    };
  }

  revalidatePath("/owner/offers");

  return {
    ok: true,
    message: "Offer updated successfully.",
  };
}

export async function deleteOfferAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  await requirePermission("offers");

  const deleted = deleteOffer(id);

  if (!deleted) {
    return {
      ok: false,
      message: "Offer not found.",
    };
  }

  revalidatePath("/owner/offers");

  return {
    ok: true,
    message: "Offer deleted.",
  };
}

export async function toggleOfferAction(
  id: string,
  active: boolean
): Promise<{ ok: boolean; message: string }> {
  await requirePermission("offers");

  const offer = setOfferActive(id, active);

  if (!offer) {
    return {
      ok: false,
      message: "Offer not found.",
    };
  }

  revalidatePath("/owner/offers");

  return {
    ok: true,
    message: active
      ? "Offer activated."
      : "Offer paused.",
  };
}