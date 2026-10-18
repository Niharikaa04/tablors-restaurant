import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { categories, menuItems, orderItems, orders } from "@/server/db/schema";
import type {
  DeleteMenuItemResult,
  MenuItem,
  MenuWriteData,
  MenuWriteResult,
} from "@/server/modules/demo-store/store";

/** Every column except the (large) image payload. */
const lightColumns = {
  id: menuItems.id,
  code: menuItems.code,
  name: menuItems.name,
  description: menuItems.description,
  category: menuItems.category,
  pricePaise: menuItems.pricePaise,
  veg: menuItems.veg,
  available: menuItems.available,
  prepMinutes: menuItems.prepMinutes,
  isSpecial: menuItems.isSpecial,
  discountPercent: menuItems.discountPercent,
  imageMime: menuItems.imageMime,
  archivedAt: menuItems.archivedAt,
  updatedAt: menuItems.updatedAt,
};

type LightRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  pricePaise: number;
  veg: boolean;
  available: boolean;
  prepMinutes: number;
  isSpecial: boolean;
  discountPercent: number;
  imageMime: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

function toMenuItem(r: LightRow): MenuItem {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    category: r.category,
    priceRupees: r.pricePaise / 100,
    veg: r.veg,
    available: r.available,
    prepMinutes: r.prepMinutes,
    imageUrl: r.imageMime
      ? `/api/menu-image/${r.id}?v=${r.updatedAt.getTime()}`
      : null,
    isSpecial: r.isSpecial,
    discountPercent: r.discountPercent,
    archivedAt: r.archivedAt ? r.archivedAt.getTime() : null,
  };
}

const menuOrder = [
  asc(menuItems.createdAt),
  asc(sql`length(${menuItems.id})`),
  asc(menuItems.id),
];

/** Active (non-archived) menu, the canonical list for every surface. */
export async function getMenuDb(restaurantId: string): Promise<MenuItem[]> {
  const rows = await db
    .select(lightColumns)
    .from(menuItems)
    .where(
      and(eq(menuItems.restaurantId, restaurantId), isNull(menuItems.archivedAt)),
    )
    .orderBy(...menuOrder);
  return rows.map(toMenuItem);
}

/** Includes archived items so historical order lines keep resolving. */
export async function getMenuIncludingArchivedDb(
  restaurantId: string,
): Promise<MenuItem[]> {
  const rows = await db
    .select(lightColumns)
    .from(menuItems)
    .where(eq(menuItems.restaurantId, restaurantId))
    .orderBy(...menuOrder);
  return rows.map(toMenuItem);
}

export async function getMenuItemByIdDb(
  restaurantId: string,
  id: string,
): Promise<MenuItem | null> {
  const [row] = await db
    .select(lightColumns)
    .from(menuItems)
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.id, id),
        isNull(menuItems.archivedAt),
      ),
    );
  return row ? toMenuItem(row) : null;
}

async function getActiveByCode(
  exec: Pick<typeof db, "select">,
  restaurantId: string,
  code: string,
) {
  const [row] = await exec
    .select(lightColumns)
    .from(menuItems)
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.code, code),
        isNull(menuItems.archivedAt),
      ),
    );
  return row ?? null;
}

/** How many order lines reference each menu item (to warn before delete). */
export async function getMenuItemUsageDb(
  restaurantId: string,
): Promise<Record<string, number>> {
  const rows = await db
    .select({ id: orderItems.menuItemId, n: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orders.restaurantId, restaurantId))
    .groupBy(orderItems.menuItemId);

  const usage: Record<string, number> = {};
  for (const r of rows) if (r.id) usage[r.id] = Number(r.n);
  return usage;
}

export async function getMenuImageDb(
  restaurantId: string,
  id: string,
): Promise<{ mime: string; bytes: Uint8Array; version: number } | null> {
  const [row] = await db
    .select({
      mime: menuItems.imageMime,
      data: menuItems.imageData,
      updatedAt: menuItems.updatedAt,
    })
    .from(menuItems)
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.id, id),
        isNull(menuItems.archivedAt),
      ),
    );
  if (!row?.mime || !row.data) return null;
  return {
    mime: row.mime,
    bytes: new Uint8Array(Buffer.from(row.data, "base64")),
    version: row.updatedAt.getTime(),
  };
}

export async function setItemAvailabilityDb(
  restaurantId: string,
  code: string,
  available: boolean,
): Promise<MenuItem | null> {
  const [row] = await db
    .update(menuItems)
    .set({ available, updatedAt: new Date() })
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.code, code),
        isNull(menuItems.archivedAt),
      ),
    )
    .returning(lightColumns);
  return row ? toMenuItem(row) : null;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

async function ensureCategory(
  tx: Pick<typeof db, "select" | "insert">,
  restaurantId: string,
  name: string,
): Promise<string> {
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.restaurantId, restaurantId), eq(categories.name, name)));
  if (existing) return existing.id;

  const [{ n }] = await tx
    .select({ n: count() })
    .from(categories)
    .where(eq(categories.restaurantId, restaurantId));

  const id = `cat_${randomUUID()}`;
  await tx
    .insert(categories)
    .values({ id, restaurantId, name, sortOrder: Number(n) })
    .onConflictDoNothing();

  const [row] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.restaurantId, restaurantId), eq(categories.name, name)));
  return row?.id ?? id;
}

export async function createMenuItemDb(
  restaurantId: string,
  data: MenuWriteData,
): Promise<MenuWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<MenuWriteResult> => {
      const owner = await getActiveByCode(tx, restaurantId, data.code);
      if (owner) {
        return { ok: false, reason: "duplicate-code", ownerName: owner.name };
      }
      const categoryId = await ensureCategory(tx, restaurantId, data.category);
      const [row] = await tx
        .insert(menuItems)
        .values({
          id: `m_${randomUUID()}`,
          restaurantId,
          categoryId,
          code: data.code,
          name: data.name,
          description: data.description,
          category: data.category,
          pricePaise: Math.round(data.priceRupees * 100),
          veg: data.veg,
          available: data.available,
          prepMinutes: data.prepMinutes,
          isSpecial: data.isSpecial,
          discountPercent: data.discountPercent,
        })
        .returning(lightColumns);
      return { ok: true, item: toMenuItem(row) };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const owner = await getActiveByCode(db, restaurantId, data.code);
      return { ok: false, reason: "duplicate-code", ownerName: owner?.name ?? data.code };
    }
    throw err;
  }
}

export async function updateMenuItemDb(
  restaurantId: string,
  id: string,
  data: MenuWriteData,
): Promise<MenuWriteResult> {
  try {
    return await db.transaction(async (tx): Promise<MenuWriteResult> => {
      const [current] = await tx
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.id, id),
            isNull(menuItems.archivedAt),
          ),
        )
        .for("update");
      if (!current) return { ok: false, reason: "not-found" };

      const owner = await getActiveByCode(tx, restaurantId, data.code);
      if (owner && owner.id !== id) {
        return { ok: false, reason: "duplicate-code", ownerName: owner.name };
      }

      const categoryId = await ensureCategory(tx, restaurantId, data.category);
      const [row] = await tx
        .update(menuItems)
        .set({
          categoryId,
          code: data.code,
          name: data.name,
          description: data.description,
          category: data.category,
          pricePaise: Math.round(data.priceRupees * 100),
          veg: data.veg,
          available: data.available,
          prepMinutes: data.prepMinutes,
          isSpecial: data.isSpecial,
          discountPercent: data.discountPercent,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, id))
        .returning(lightColumns);
      return { ok: true, item: toMenuItem(row) };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const owner = await getActiveByCode(db, restaurantId, data.code);
      return { ok: false, reason: "duplicate-code", ownerName: owner?.name ?? data.code };
    }
    throw err;
  }
}

export async function setMenuItemImageDb(
  restaurantId: string,
  id: string,
  mime: string,
  bytes: Uint8Array,
): Promise<MenuItem | null> {
  const [row] = await db
    .update(menuItems)
    .set({
      imageMime: mime,
      imageData: Buffer.from(bytes).toString("base64"),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.id, id),
        isNull(menuItems.archivedAt),
      ),
    )
    .returning(lightColumns);
  return row ? toMenuItem(row) : null;
}

export async function clearMenuItemImageDb(
  restaurantId: string,
  id: string,
): Promise<MenuItem | null> {
  const [row] = await db
    .update(menuItems)
    .set({ imageMime: null, imageData: null, updatedAt: new Date() })
    .where(
      and(
        eq(menuItems.restaurantId, restaurantId),
        eq(menuItems.id, id),
        isNull(menuItems.archivedAt),
      ),
    )
    .returning(lightColumns);
  return row ? toMenuItem(row) : null;
}

/**
 * Items that appear on any past order are archived (history keeps resolving);
 * items never ordered are removed.
 */
export async function deleteMenuItemDb(
  restaurantId: string,
  id: string,
): Promise<DeleteMenuItemResult> {
  return db.transaction(async (tx): Promise<DeleteMenuItemResult> => {
    const [item] = await tx
      .select({ id: menuItems.id, name: menuItems.name, code: menuItems.code })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.restaurantId, restaurantId),
          eq(menuItems.id, id),
          isNull(menuItems.archivedAt),
        ),
      )
      .for("update");
    if (!item) return { ok: false, reason: "not-found" };

    const [ref] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.menuItemId, id))
      .limit(1);

    if (ref) {
      const now = new Date();
      await tx
        .update(menuItems)
        .set({
          archivedAt: now,
          available: false,
          isSpecial: false,
          imageMime: null,
          imageData: null,
          updatedAt: now,
        })
        .where(eq(menuItems.id, id));
      return { ok: true, mode: "archived", name: item.name };
    }

    await tx.delete(menuItems).where(eq(menuItems.id, id));
    return { ok: true, mode: "deleted", name: item.name };
  });
}
