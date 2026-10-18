import "server-only";

import { and, asc, desc, eq, isNull, ne, notInArray, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  areas,
  bills,
  devices,
  orders,
  restaurantTables,
} from "@/server/db/schema";
import type {
  CreateTableResult,
  RemoveTableResult,
  RenameTableResult,
  ReserveTableResult,
  RestaurantTable,
  SetTableStatusResult,
} from "@/server/modules/demo-store/store";

type TableRow = typeof restaurantTables.$inferSelect;

export function toTable(t: TableRow): RestaurantTable {
  return {
    id: t.id,
    label: t.label,
    status: t.status,
    currentOrderId: t.currentOrderId,
    waiterCalled: t.waiterCalled,
    waiterCalledAt: t.waiterCalledAt ? t.waiterCalledAt.getTime() : null,
  };
}

const live = (restaurantId: string) =>
  and(
    eq(restaurantTables.restaurantId, restaurantId),
    isNull(restaurantTables.archivedAt),
  );

export async function getTablesDb(
  restaurantId: string,
): Promise<RestaurantTable[]> {
  const rows = await db
    .select()
    .from(restaurantTables)
    .where(live(restaurantId))
    .orderBy(asc(restaurantTables.number), asc(restaurantTables.label));
  return rows.map(toTable);
}

export async function getTableByIdDb(
  restaurantId: string,
  tableId: string,
): Promise<RestaurantTable | null> {
  const [row] = await db
    .select()
    .from(restaurantTables)
    .where(and(live(restaurantId), eq(restaurantTables.id, tableId)));
  return row ? toTable(row) : null;
}

/** Any order still in progress, or any unpaid bill, keeps a table busy. */
async function tableIsBusy(
  exec: Pick<typeof db, "select">,
  restaurantId: string,
  table: TableRow,
): Promise<boolean> {
  if (table.currentOrderId !== null) {
    // currentOrderId can be stale; only trust it if that order is still open.
    const [open] = await exec
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.id, table.currentOrderId),
          notInArray(orders.status, ["billed", "cancelled"]),
        ),
      );
    if (open) return true;
  }

  const [activeOrder] = await exec
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.tableId, table.id),
        notInArray(orders.status, ["billed", "cancelled"]),
      ),
    )
    .limit(1);
  if (activeOrder) return true;

  const [unpaid] = await exec
    .select({ id: bills.id })
    .from(bills)
    .where(
      and(
        eq(bills.restaurantId, restaurantId),
        eq(bills.tableId, table.id),
        isNull(bills.paidAt),
      ),
    )
    .limit(1);
  return Boolean(unpaid);
}

export async function createTableDb(
  restaurantId: string,
  label: string,
): Promise<CreateTableResult> {
  const normalized = label.trim();
  if (!normalized) return { ok: false, reason: "invalid-label" };

  return db.transaction(async (tx): Promise<CreateTableResult> => {
    // Serialise table creation per restaurant so ids/numbers never collide.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"tables:" + restaurantId}))`,
    );

    const existing = await tx
      .select()
      .from(restaurantTables)
      .where(live(restaurantId));

    if (
      existing.some((t) => t.label.toLowerCase() === normalized.toLowerCase())
    ) {
      return { ok: false, reason: "duplicate-label" };
    }

    // Ids and numbers of archived tables are never reused (history keeps them).
    const all = await tx
      .select({ id: restaurantTables.id, number: restaurantTables.number })
      .from(restaurantTables)
      .where(eq(restaurantTables.restaurantId, restaurantId));

    let next = 0;
    for (const t of all) {
      const m = t.id.match(/^t(\d+)$/);
      if (m) next = Math.max(next, Number(m[1]));
      if (t.number !== null) next = Math.max(next, t.number);
    }
    next += 1;

    const [area] = await tx
      .select({ id: areas.id })
      .from(areas)
      .where(eq(areas.restaurantId, restaurantId))
      .orderBy(asc(areas.sortOrder))
      .limit(1);

    const [created] = await tx
      .insert(restaurantTables)
      .values({
        id: `t${String(next).padStart(2, "0")}`,
        restaurantId,
        areaId: area?.id ?? null,
        label: normalized,
        number: next,
        status: "available",
      })
      .returning();

    return { ok: true, table: toTable(created) };
  });
}

export async function removeTableDb(
  restaurantId: string,
  tableId: string,
): Promise<RemoveTableResult> {
  return db.transaction(async (tx): Promise<RemoveTableResult> => {
    const [table] = await tx
      .select()
      .from(restaurantTables)
      .where(and(live(restaurantId), eq(restaurantTables.id, tableId)))
      .for("update");
    if (!table) return { ok: false, reason: "not-found" };

    if (await tableIsBusy(tx, restaurantId, table)) {
      return { ok: false, reason: "has-active-order" };
    }

    const now = new Date();
    // Soft delete keeps every past order/bill/payment for this table intact.
    // The number is released so a new table can use it.
    await tx
      .update(restaurantTables)
      .set({ archivedAt: now, number: null, currentOrderId: null, updatedAt: now })
      .where(eq(restaurantTables.id, tableId));

    // Unassign (never delete) any device that was on this table.
    await tx
      .update(devices)
      .set({ tableId: null, updatedAt: now })
      .where(
        and(eq(devices.restaurantId, restaurantId), eq(devices.tableId, tableId)),
      );

    return { ok: true, label: table.label };
  });
}

export async function renameTableDb(
  restaurantId: string,
  tableId: string,
  label: string,
): Promise<RenameTableResult> {
  const normalized = label.trim().replace(/\s+/g, " ");
  if (normalized === "" || normalized.length > 40) {
    return { ok: false, reason: "invalid-label" };
  }

  return db.transaction(async (tx): Promise<RenameTableResult> => {
    const [table] = await tx
      .select()
      .from(restaurantTables)
      .where(and(live(restaurantId), eq(restaurantTables.id, tableId)))
      .for("update");
    if (!table) return { ok: false, reason: "not-found" };

    const others = await tx
      .select({ label: restaurantTables.label })
      .from(restaurantTables)
      .where(and(live(restaurantId), ne(restaurantTables.id, tableId)));
    if (others.some((o) => o.label.toLowerCase() === normalized.toLowerCase())) {
      return { ok: false, reason: "duplicate-label" };
    }

    const [updated] = await tx
      .update(restaurantTables)
      .set({ label: normalized, updatedAt: new Date() })
      .where(eq(restaurantTables.id, tableId))
      .returning();
    return { ok: true, table: toTable(updated) };
  });
}

export async function setTableStatusDb(
  restaurantId: string,
  tableId: string,
  status: "occupied" | "available",
): Promise<SetTableStatusResult> {
  return db.transaction(async (tx): Promise<SetTableStatusResult> => {
    const [table] = await tx
      .select()
      .from(restaurantTables)
      .where(and(live(restaurantId), eq(restaurantTables.id, tableId)))
      .for("update");
    if (!table) return { ok: false, reason: "not-found" };

    if (status === "available" && (await tableIsBusy(tx, restaurantId, table))) {
      return { ok: false, reason: "has-active-order" };
    }

    const [updated] = await tx
      .update(restaurantTables)
      .set({
        status,
        currentOrderId: status === "available" ? null : table.currentOrderId,
        updatedAt: new Date(),
      })
      .where(eq(restaurantTables.id, tableId))
      .returning();
    return { ok: true, table: toTable(updated) };
  });
}

export async function reserveTableDb(
  restaurantId: string,
  tableId: string,
): Promise<ReserveTableResult> {
  return db.transaction(async (tx): Promise<ReserveTableResult> => {
    const [table] = await tx
      .select()
      .from(restaurantTables)
      .where(and(live(restaurantId), eq(restaurantTables.id, tableId)))
      .for("update");
    if (!table) return { ok: false, reason: "not-found" };

    if (await tableIsBusy(tx, restaurantId, table)) {
      return { ok: false, reason: "has-active-order" };
    }
    if (table.status !== "available") {
      return { ok: false, reason: "not-available" };
    }

    const [updated] = await tx
      .update(restaurantTables)
      .set({ status: "reserved", updatedAt: new Date() })
      .where(eq(restaurantTables.id, tableId))
      .returning();
    return { ok: true, table: toTable(updated) };
  });
}

// Used by callers that need the most recent open order for a table.
export async function latestOpenOrderId(
  restaurantId: string,
  tableId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.tableId, tableId),
        notInArray(orders.status, ["billed", "cancelled"]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row?.id ?? null;
}
