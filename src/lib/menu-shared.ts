/**
 * Pure, dependency-free menu helpers shared by the Owner form (client) and
 * the server actions. The client uses these only to give instant inline
 * feedback — the server ALWAYS re-runs the same validation against the
 * authoritative store before any write, so nothing here is trusted.
 */

// ---- Constants ------------------------------------------------------

/** Item codes are exactly three digits (001–999), matching every seeded
 * item and the keypad-style ordering the device uses. */
export const ITEM_CODE_PATTERN = /^\d{3}$/;
export const ITEM_CODE_HINT = "3 digits, e.g. 099";

export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 160;
export const CATEGORY_MAX = 40;
export const PRICE_MAX_RUPEES = 100000;
export const PREP_MAX_MINUTES = 240;
export const DISCOUNT_MAX_PERCENT = 100;

export const IMAGE_MAX_BYTES = 512 * 1024; // stays under the 1 MB server-action body limit
export const IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// ---- Pricing ----------------------------------------------------------

export type Priced = { priceRupees: number; discountPercent: number };

/** Price a customer actually pays. Base price is never overwritten. */
export function getEffectivePrice(item: Priced): number {
  const pct = item.discountPercent;
  if (!pct || pct <= 0) return item.priceRupees;
  return Math.round((item.priceRupees * (100 - pct)) / 100);
}

export function formatRupees(amount: number): string {
  return `₹${amount}`;
}

// ---- Validation -------------------------------------------------------

export type MenuFormField =
  | "name"
  | "code"
  | "description"
  | "priceRupees"
  | "category"
  | "veg"
  | "prepMinutes"
  | "discountPercent"
  | "image";

export type MenuFieldErrors = Partial<Record<MenuFormField, string>>;

/** Raw (string-typed) values as they come from a form / FormData. */
export type MenuFormValues = {
  name: string;
  code: string;
  description: string;
  priceRupees: string;
  category: string;
  veg: string; // "veg" | "non-veg" | ""
  prepMinutes: string;
  available: boolean;
  isSpecial: boolean;
  discountPercent: string;
};

export type ParsedMenuInput = {
  name: string;
  code: string;
  description: string;
  priceRupees: number;
  category: string;
  veg: boolean;
  prepMinutes: number;
  available: boolean;
  isSpecial: boolean;
  discountPercent: number;
};

export type ExistingCodeOwner = { id: string; code: string; name: string };

function parseWholeNumber(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Validates + normalises menu form values.
 *
 * @param existing  every ACTIVE menu item (id/code/name) — used for the
 *                  unique-code rule and to normalise category casing.
 * @param editingId the item being edited (its own code is not a duplicate).
 */
export function validateMenuInput(
  values: MenuFormValues,
  existing: ExistingCodeOwner[],
  existingCategories: string[],
  editingId: string | null
): { ok: true; value: ParsedMenuInput } | { ok: false; errors: MenuFieldErrors } {
  const errors: MenuFieldErrors = {};

  const name = values.name.trim().replace(/\s+/g, " ");
  if (!name) errors.name = "Item name is required.";
  else if (name.length > NAME_MAX) errors.name = `Keep the name under ${NAME_MAX} characters.`;

  const code = values.code.trim();
  if (!code) errors.code = "Item code is required.";
  else if (!ITEM_CODE_PATTERN.test(code)) errors.code = `Code must be ${ITEM_CODE_HINT}.`;
  else {
    const owner = existing.find((m) => m.code === code && m.id !== editingId);
    if (owner) errors.code = `Code ${code} is already used by “${owner.name}”.`;
  }

  const description = values.description.trim();
  if (description.length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`;
  }

  let priceRupees = 0;
  if (values.priceRupees.trim() === "") errors.priceRupees = "Price is required.";
  else {
    const n = parseWholeNumber(values.priceRupees);
    if (n === null) errors.priceRupees = "Enter a valid price in whole rupees (0 or more).";
    else if (n > PRICE_MAX_RUPEES) errors.priceRupees = `Price can't exceed ₹${PRICE_MAX_RUPEES}.`;
    else priceRupees = n;
  }

  let category = values.category.trim().replace(/\s+/g, " ");
  if (!category) errors.category = "Choose or enter a category.";
  else if (category.length > CATEGORY_MAX) errors.category = `Keep the category under ${CATEGORY_MAX} characters.`;
  else {
    // Never create "chicken" next to "Chicken" — reuse the existing spelling.
    const match = existingCategories.find((c) => c.toLowerCase() === category.toLowerCase());
    if (match) category = match;
  }

  let veg = true;
  if (values.veg === "veg") veg = true;
  else if (values.veg === "non-veg") veg = false;
  else errors.veg = "Choose Veg or Non-Veg.";

  let prepMinutes = 0;
  if (values.prepMinutes.trim() === "") errors.prepMinutes = "Preparation time is required.";
  else {
    const n = parseWholeNumber(values.prepMinutes);
    if (n === null) errors.prepMinutes = "Enter a valid time in whole minutes (0 or more).";
    else if (n > PREP_MAX_MINUTES) errors.prepMinutes = `Preparation time can't exceed ${PREP_MAX_MINUTES} min.`;
    else prepMinutes = n;
  }

  let discountPercent = 0;
  if (values.discountPercent.trim() !== "") {
    const n = parseWholeNumber(values.discountPercent);
    if (n === null || n > DISCOUNT_MAX_PERCENT) {
      errors.discountPercent = `Discount must be a whole number from 0 to ${DISCOUNT_MAX_PERCENT}.`;
    } else discountPercent = n;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      code,
      description,
      priceRupees,
      category,
      veg,
      prepMinutes,
      available: values.available,
      isSpecial: values.isSpecial,
      discountPercent,
    },
  };
}

/** Returns an error message, or null when the file is an acceptable image. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return "Image must be a JPEG, PNG or WebP file.";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return `Image must be ${Math.round(IMAGE_MAX_BYTES / 1024)} KB or smaller.`;
  }
  if (file.size === 0) return "That image file is empty.";
  return null;
}
