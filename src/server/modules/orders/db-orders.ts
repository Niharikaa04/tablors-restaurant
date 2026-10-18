
import "server-only";

import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  notInArray,
} from "drizzle-orm";

import { db } from "@/server/db/client";
import {
  orders,
  orderItems,
  orderEvents,
  restaurantTables,
  menuItems,
} from "@/server/db/schema";
import { getEffectivePrice } from "@/lib/menu-shared";

import type {
  Order,
  OrderLine,
  OrderStatus,
  RestaurantTable,
} from "@/server/modules/demo-store/store";

const MAX_LINE_QTY = 99;
const FLOW: OrderStatus[] = ["new", "preparing", "ready", "served"];

class OrderError extends Error {}

export type CreateOrderInput = {
  restaurantId: string;
  tableId: string;
  lines: { code: string; qty: number; itemId?: string }[];
};

export type CreateOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

type OrderRow = typeof orders.$inferSelect;

/**
 * Converts database order rows and their order items into the existing
 * Order/OrderLine UI shape.
 */
async function hydrateOrders(rows: OrderRow[]): Promise<Order[]> {
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map((r) => r.id)))
    .orderBy(asc(orderItems.createdAt));

  const byOrder = new Map<string, OrderLine[]>();

  for (const it of items) {
    const line: OrderLine = {
      code: it.code,
      name: it.nameSnapshot,
      qty: it.qty,
      priceRupees: it.pricePaise / 100,
      itemId: it.menuItemId ?? undefined,
      category: it.categorySnapshot ?? undefined,
      prepMinutes: it.prepMinutes ?? undefined,
      basePriceRupees:
        it.basePricePaise != null
          ? it.basePricePaise / 100
          : undefined,
      discountPercent: it.discountPercent ?? undefined,
    };

    const list = byOrder.get(it.orderId) ?? [];
    list.push(line);
    byOrder.set(it.orderId, list);
  }

  return rows.map((r) => ({
    id: r.id,
    tableId: r.tableId,
    lines: byOrder.get(r.id) ?? [],
    status: r.status as OrderStatus,
    createdAt: r.createdAt.getTime(),
    statusUpdatedAt: r.statusUpdatedAt.getTime(),
  }));
}

/**
 * Creates an order and its items in one transaction, validates menu items,
 * records the initial order event, and marks the table occupied.
 */
export async function createOrderInDb(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  try {
    const orderId = await db.transaction(async (tx) => {
      const [table] = await tx
        .select()
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.id, input.tableId),
            eq(restaurantTables.restaurantId, input.restaurantId),
            isNull(restaurantTables.archivedAt),
          ),
        )
        .for("update");

      if (!table) {
        throw new OrderError("Table not found.");
      }

      const menu = await tx
        .select()
        .from(menuItems)
        .where(eq(menuItems.restaurantId, input.restaurantId));

      const active = menu.filter((m) => m.archivedAt === null);

      const problems: string[] = [];
      const merged = new Map<
        string,
        { item: (typeof active)[number]; qty: number }
      >();

      for (const line of input.lines) {
        if (
          !Number.isInteger(line?.qty) ||
          line.qty < 1 ||
          line.qty > MAX_LINE_QTY
        ) {
          problems.push(
            `Quantity must be a whole number from 1 to ${MAX_LINE_QTY}.`,
          );
          continue;
        }

        const item =
          typeof line.itemId === "string" && line.itemId
            ? active.find((m) => m.id === line.itemId)
            : active.find((m) => m.code === String(line.code));

        if (!item) {
          problems.push(
            `Item ${line.code} is no longer on the menu — please remove it.`,
          );
          continue;
        }

        if (!item.available) {
          problems.push(
            `${item.name} just became unavailable — please remove it.`,
          );
          continue;
        }

        const existing = merged.get(item.id);

        if (existing) {
          existing.qty += line.qty;
        } else {
          merged.set(item.id, { item, qty: line.qty });
        }
      }

      if (problems.length > 0) {
        throw new OrderError(Array.from(new Set(problems)).join(" "));
      }

      if (merged.size === 0) {
        throw new OrderError("Your cart is empty.");
      }

      const id = randomUUID();
      const now = new Date();

      await tx.insert(orders).values({
        id,
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        status: "new",
        createdAt: now,
        statusUpdatedAt: now,
        updatedAt: now,
      });

      const itemRows: (typeof orderItems.$inferInsert)[] = [];

      for (const { item, qty } of merged.values()) {
        if (qty > MAX_LINE_QTY) {
          throw new OrderError(
            `${item.name}: quantity can't exceed ${MAX_LINE_QTY}.`,
          );
        }

        // Use the existing pricing rule, which expects prices in rupees.
        const effectiveRupees = getEffectivePrice({
          priceRupees: item.pricePaise / 100,
          discountPercent: item.discountPercent,
        } as Parameters<typeof getEffectivePrice>[0]);

        itemRows.push({
          id: randomUUID(),
          orderId: id,
          menuItemId: item.id,
          code: item.code,
          nameSnapshot: item.name,
          categorySnapshot: item.category,
          qty,
          pricePaise: Math.round(effectiveRupees * 100),
          basePricePaise: item.pricePaise,
          discountPercent: item.discountPercent,
          prepMinutes: item.prepMinutes,
        });
      }

      await tx.insert(orderItems).values(itemRows);

      await tx.insert(orderEvents).values({
        id: randomUUID(),
        restaurantId: input.restaurantId,
        orderId: id,
        fromStatus: null,
        toStatus: "new",
      });

      await tx
        .update(restaurantTables)
        .set({
          status: "occupied",
          currentOrderId: id,
          updatedAt: now,
        })
        .where(
          and(
            eq(restaurantTables.id, input.tableId),
            eq(restaurantTables.restaurantId, input.restaurantId),
          ),
        );

      return id;
    });

    return { ok: true, orderId };
  } catch (err) {
    if (err instanceof OrderError) {
      return { ok: false, error: err.message };
    }

    console.error("createOrderInDb failed", err);

    return {
      ok: false,
      error: "Could not place the order. Please try again.",
    };
  }
}

/** Active (not billed/cancelled) orders in the existing UI shape. */
export async function listActiveOrders(
  restaurantId: string,
): Promise<Order[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        notInArray(orders.status, ["billed", "cancelled"]),
      ),
    )
    .orderBy(asc(orders.createdAt));

  return hydrateOrders(rows);
}

/** Every order, including billed and cancelled orders, for history/reports. */
export async function listAllOrders(
  restaurantId: string,
): Promise<Order[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))
    .orderBy(asc(orders.createdAt));

  return hydrateOrders(rows);
}

/** Fetches one order belonging to the specified restaurant. */
export async function getOrderFromDb(
  restaurantId: string,
  orderId: string,
): Promise<Order | null> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.restaurantId, restaurantId),
      ),
    );

  return (await hydrateOrders(rows))[0] ?? null;
}

/** Lists the restaurant's tables in the existing UI shape. */
export async function listTables(
  restaurantId: string,
): Promise<RestaurantTable[]> {
  const rows = await db
    .select()
    .from(restaurantTables)
    .where(
      and(
        eq(restaurantTables.restaurantId, restaurantId),
        isNull(restaurantTables.archivedAt),
      ),
    )
    .orderBy(
      asc(restaurantTables.number),
      asc(restaurantTables.label),
    );

  return rows.map((t) => ({
    id: t.id,
    label: t.label,
    status: t.status,
    currentOrderId: t.currentOrderId,
    waiterCalled: t.waiterCalled,
    waiterCalledAt: t.waiterCalledAt
      ? t.waiterCalledAt.getTime()
      : null,
  }));
}

export type TransitionDbResult =
  | { ok: true; from: OrderStatus; to: OrderStatus }
  | {
      ok: false;
      reason:
        | "not-found"
        | "already-served"
        | "already-billed"
        | "status-changed";
    };

/**
 * Moves an order one step: new → preparing → ready → served.
 * The status-guarded update prevents concurrent actions from skipping steps.
 */
export async function transitionOrderInDb(
  restaurantId: string,
  orderId: string,
  expectedFrom?: OrderStatus,
  actorUserId?: string,
): Promise<TransitionDbResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.restaurantId, restaurantId),
        ),
      );

    if (!order) {
      return { ok: false, reason: "not-found" } as const;
    }

    if (order.status === "billed") {
      return { ok: false, reason: "already-billed" } as const;
    }

    if (expectedFrom !== undefined && order.status !== expectedFrom) {
      return { ok: false, reason: "status-changed" } as const;
    }

    const idx = FLOW.indexOf(order.status as OrderStatus);

    if (idx === -1 || idx === FLOW.length - 1) {
      return { ok: false, reason: "already-served" } as const;
    }

    const from = order.status as OrderStatus;
    const to = FLOW[idx + 1];
    const now = new Date();

    const updated = await tx
      .update(orders)
      .set({
        status: to,
        statusUpdatedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.restaurantId, restaurantId),
          eq(orders.status, from),
        ),
      )
      .returning({ id: orders.id });

    if (updated.length === 0) {
      return { ok: false, reason: "status-changed" } as const;
    }

    await tx.insert(orderEvents).values({
      id: randomUUID(),
      restaurantId,
      orderId,
      fromStatus: from,
      toStatus: to,
      actorUserId: actorUserId ?? null,
    });

    return { ok: true, from, to } as const;
  });
}

/** Updates whether a restaurant table has an outstanding waiter call. */
export async function setWaiterCalledInDb(
  restaurantId: string,
  tableId: string,
  called: boolean,
): Promise<boolean> {
  const now = new Date();

  const rows = await db
    .update(restaurantTables)
    .set({
      waiterCalled: called,
      waiterCalledAt: called ? now : null,
      updatedAt: now,
    })
    .where(
      and(
        eq(restaurantTables.id, tableId),
        eq(restaurantTables.restaurantId, restaurantId),
      ),
    )
    .returning({ id: restaurantTables.id });

  return rows.length > 0;
}
