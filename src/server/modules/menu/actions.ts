"use server";

import { revalidatePath } from "next/cache";

import { getDemoRole } from "@/server/modules/auth/session";

import {
  clearMenuItemImage,
  createMenuItem,
  deleteMenuItem,
  getMenu,
  getMenuItemById,
  setItemAvailability,
  setMenuItemImage,
  updateMenuItem,
  type MenuItem,
} from "@/server/modules/demo-store/store";

import {
  validateImageFile,
  validateMenuInput,
  type MenuFieldErrors,
  type MenuFormValues,
} from "@/lib/menu-shared";

import { notifyDevicesOfMenuChange } from "./device-sync";

import {
  notify,
  resolveByKey,
} from "@/server/modules/notifications/store";

export type ToggleAvailabilityResult =
  | { ok: true }
  | { ok: false; error: string };

export type MenuMutationResult =
  | { ok: true; message: string; item?: MenuItem }
  | { ok: false; error: string; fieldErrors?: MenuFieldErrors };

/**
 * Revalidate every surface that reads the canonical menu.
 */
function revalidateMenuSurfaces(): void {
  revalidatePath("/owner");
  revalidatePath("/owner/menu");
  revalidatePath("/kitchen");
  revalidatePath("/customer/menu");
  revalidatePath("/customer/[tableId]", "page");
}

/**
 * Change menu item availability.
 *
 * Owner / Kitchen / Admin can change availability.
 *
 * When an item becomes unavailable:
 * → create ITEM_UNAVAILABLE notification
 *
 * When it becomes available again:
 * → resolve the ITEM_UNAVAILABLE notification
 */
export async function toggleItemAvailability(
  code: string,
  nextAvailable: boolean,
): Promise<ToggleAvailabilityResult> {
  const role = await getDemoRole();

  if (
    role !== "owner" &&
    role !== "kitchen" &&
    role !== "admin"
  ) {
    return {
      ok: false,
      error: "Not authorized to change menu availability.",
    };
  }

  const item = setItemAvailability(code, nextAvailable);

  if (!item) {
    return {
      ok: false,
      error: "Menu item not found.",
    };
  }

  /*
   * Tell all connected table devices that the menu changed.
   */
  await notifyDevicesOfMenuChange({
    reason: "availability-changed",
    itemId: item.id,
  });

  /*
   * ITEM_UNAVAILABLE notification
   */
  if (!nextAvailable) {
    notify({
      type: "ITEM_UNAVAILABLE",
      title: "Item unavailable",
      message: `${item.name} is now unavailable.`,
      dedupeKey: `item-unavailable:${item.id}`,
    });
  }

  /*
   * Item became available again.
   * Resolve the existing notification.
   */
  if (nextAvailable) {
    resolveByKey(`item-unavailable:${item.id}`);
  }

  revalidateMenuSurfaces();

  return {
    ok: true,
  };
}

// ---------------------------------------------------------------------
// OWNER-ONLY MENU MANAGEMENT
// ---------------------------------------------------------------------

const NOT_OWNER =
  "Only the restaurant owner can change menu items.";

function text(fd: FormData, key: string): string {
  const value = fd.get(key);

  return typeof value === "string"
    ? value
    : "";
}

function readValues(fd: FormData): MenuFormValues {
  return {
    name: text(fd, "name"),
    code: text(fd, "code"),
    description: text(fd, "description"),
    priceRupees: text(fd, "priceRupees"),
    category: text(fd, "category"),
    veg: text(fd, "veg"),
    prepMinutes: text(fd, "prepMinutes"),
    available: text(fd, "available") === "true",
    isSpecial: text(fd, "isSpecial") === "true",
    discountPercent: text(fd, "discountPercent"),
  };
}

/**
 * Confirm that the uploaded bytes really match
 * JPEG / PNG / WebP.
 */
function sniffImageType(
  bytes: Uint8Array,
): string | null {
  // JPEG
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

type ImageIntent =
  | { kind: "none" }
  | { kind: "remove" }
  | {
      kind: "set";
      mime: string;
      bytes: Uint8Array;
    }
  | {
      kind: "invalid";
      error: string;
    };

async function readImageIntent(
  fd: FormData,
): Promise<ImageIntent> {
  const file = fd.get("image");

  if (file instanceof File && file.size > 0) {
    const problem = validateImageFile({
      type: file.type,
      size: file.size,
    });

    if (problem) {
      return {
        kind: "invalid",
        error: problem,
      };
    }

    const bytes = new Uint8Array(
      await file.arrayBuffer(),
    );

    const sniffed = sniffImageType(bytes);

    if (!sniffed) {
      return {
        kind: "invalid",
        error:
          "That file isn't a valid JPEG, PNG or WebP image.",
      };
    }

    return {
      kind: "set",
      mime: sniffed,
      bytes,
    };
  }

  if (text(fd, "removeImage") === "true") {
    return {
      kind: "remove",
    };
  }

  return {
    kind: "none",
  };
}

// ---------------------------------------------------------------------
// CREATE MENU ITEM
// ---------------------------------------------------------------------

export async function createMenuItemAction(
  formData: FormData,
): Promise<MenuMutationResult> {
  if ((await getDemoRole()) !== "owner") {
    return {
      ok: false,
      error: NOT_OWNER,
    };
  }

  const active = getMenu();

  const parsed = validateMenuInput(
    readValues(formData),
    active.map((menuItem) => ({
      id: menuItem.id,
      code: menuItem.code,
      name: menuItem.name,
    })),
    Array.from(
      new Set(
        active.map(
          (menuItem) => menuItem.category,
        ),
      ),
    ),
    null,
  );

  if (!parsed.ok) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.errors,
    };
  }

  const image = await readImageIntent(formData);

  if (image.kind === "invalid") {
    return {
      ok: false,
      error: image.error,
      fieldErrors: {
        image: image.error,
      },
    };
  }

  const result = createMenuItem(parsed.value);

  if (!result.ok) {
    if (result.reason === "duplicate-code") {
      const message =
        `Code ${parsed.value.code} is already used by ` +
        `“${result.ownerName}”.`;

      return {
        ok: false,
        error: message,
        fieldErrors: {
          code: message,
        },
      };
    }

    return {
      ok: false,
      error: "Couldn't create the item.",
    };
  }

  if (image.kind === "set") {
    setMenuItemImage(
      result.item.id,
      image.mime,
      image.bytes,
    );
  }

  await notifyDevicesOfMenuChange({
    reason: "item-created",
    itemId: result.item.id,
  });

  revalidateMenuSurfaces();

  return {
    ok: true,
    message: `Added ${result.item.name}.`,
    item: result.item,
  };
}

// ---------------------------------------------------------------------
// UPDATE MENU ITEM
// ---------------------------------------------------------------------

export async function updateMenuItemAction(
  id: string,
  formData: FormData,
): Promise<MenuMutationResult> {
  if ((await getDemoRole()) !== "owner") {
    return {
      ok: false,
      error: NOT_OWNER,
    };
  }

  if (!getMenuItemById(id)) {
    return {
      ok: false,
      error: "That menu item no longer exists.",
    };
  }

  const active = getMenu();

  const parsed = validateMenuInput(
    readValues(formData),
    active.map((menuItem) => ({
      id: menuItem.id,
      code: menuItem.code,
      name: menuItem.name,
    })),
    Array.from(
      new Set(
        active.map(
          (menuItem) => menuItem.category,
        ),
      ),
    ),
    id,
  );

  if (!parsed.ok) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.errors,
    };
  }

  const image = await readImageIntent(formData);

  if (image.kind === "invalid") {
    return {
      ok: false,
      error: image.error,
      fieldErrors: {
        image: image.error,
      },
    };
  }

  const result = updateMenuItem(
    id,
    parsed.value,
  );

  if (!result.ok) {
    if (result.reason === "duplicate-code") {
      const message =
        `Code ${parsed.value.code} is already used by ` +
        `“${result.ownerName}”.`;

      return {
        ok: false,
        error: message,
        fieldErrors: {
          code: message,
        },
      };
    }

    return {
      ok: false,
      error: "That menu item no longer exists.",
    };
  }

  if (image.kind === "set") {
    setMenuItemImage(
      id,
      image.mime,
      image.bytes,
    );
  } else if (image.kind === "remove") {
    clearMenuItemImage(id);
  }

  await notifyDevicesOfMenuChange({
    reason: "item-updated",
    itemId: id,
  });

  revalidateMenuSurfaces();

  return {
    ok: true,
    message: `Saved ${result.item.name}.`,
    item: result.item,
  };
}

// ---------------------------------------------------------------------
// DELETE MENU ITEM
// ---------------------------------------------------------------------

export async function deleteMenuItemAction(
  id: string,
): Promise<MenuMutationResult> {
  if ((await getDemoRole()) !== "owner") {
    return {
      ok: false,
      error: NOT_OWNER,
    };
  }

  const result = deleteMenuItem(id);

  if (!result.ok) {
    return {
      ok: false,
      error: "That menu item no longer exists.",
    };
  }

  await notifyDevicesOfMenuChange({
    reason:
      result.mode === "archived"
        ? "item-archived"
        : "item-deleted",
    itemId: id,
  });

  revalidateMenuSurfaces();

  return {
    ok: true,
    message:
      result.mode === "archived"
        ? `${result.name} was removed from the menu. Past orders that include it are unchanged.`
        : `${result.name} was deleted.`,
  };
}