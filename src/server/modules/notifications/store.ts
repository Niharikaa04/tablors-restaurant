import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";

import { db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import {
  NOTIFICATION_TYPES,
  type Notification,
  type NotifyInput,
  type Role,
  type Status,
} from "./types";

/**
 * PostgreSQL-backed notifications. Replaces the old in-process array and
 * EventEmitter, which lost every notification on each serverless cold start
 * and could not reach other instances.
 *
 * Every function is async: callers must `await` them, otherwise the request
 * can finish before the write happens.
 */

type Row = typeof notifications.$inferSelect;

const KEEP = 200;

function toNotification(r: Row): Notification {
  return {
    id: r.id,
    type: r.type as Notification["type"],
    priority: r.priority,
    targetRoles: r.targetRoles as Notification["targetRoles"],
    title: r.title,
    message: r.message,
    tableId: r.tableId ?? undefined,
    orderId: r.orderId ?? undefined,
    deviceId: r.deviceId ?? undefined,
    dedupeKey: r.dedupeKey ?? undefined,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    ...(r.resolvedAt ? { resolvedAt: r.resolvedAt.toISOString() } : {}),
  } as Notification;
}

export async function notify(
  input: NotifyInput,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<Notification> {
  const config = NOTIFICATION_TYPES[input.type];

  if (input.dedupeKey) {
    const [existing] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.restaurantId, restaurantId),
          eq(notifications.dedupeKey, input.dedupeKey),
          ne(notifications.status, "resolved"),
        ),
      )
      .limit(1);
    if (existing) return toNotification(existing);
  }

  const [row] = await db
    .insert(notifications)
    .values({
      id: randomUUID(),
      restaurantId,
      type: input.type,
      priority: input.priorityOverride ?? config.priority,
      targetRoles: [...config.roles],
      tableId: input.tableId ?? null,
      orderId: input.orderId ?? null,
      deviceId: input.deviceId ?? null,
      title: input.title,
      message: input.message,
      dedupeKey: input.dedupeKey ?? null,
      status: "unread",
    })
    .returning();

  return toNotification(row);
}

export async function listFor(
  role: Role,
  type?: string | null,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.restaurantId, restaurantId),
        sql`${role} = ANY(${notifications.targetRoles})`,
        type ? eq(notifications.type, type) : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(KEEP);
  return rows.map(toNotification);
}

/** Notifications for a role created strictly after `since` (oldest first). */
export async function listSince(
  role: Role,
  since: Date,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<Notification[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.restaurantId, restaurantId),
        gt(notifications.createdAt, since),
        sql`${role} = ANY(${notifications.targetRoles})`,
      ),
    )
    .orderBy(notifications.createdAt)
    .limit(KEEP);
  return rows.map(toNotification);
}

export async function setStatus(
  id: string,
  role: Role,
  status: Status,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({
      status,
      readAt: status === "unread" ? null : new Date(),
      resolvedAt: status === "resolved" ? new Date() : null,
    })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.restaurantId, restaurantId),
        sql`${role} = ANY(${notifications.targetRoles})`,
      ),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}

/** Permanently removes one notification the given role is allowed to see. */
export async function deleteNotification(
  id: string,
  role: Role,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<boolean> {
  const rows = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.restaurantId, restaurantId),
        sql`${role} = ANY(${notifications.targetRoles})`,
      ),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function resolveByKey(
  dedupeKey: string,
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(
      and(
        eq(notifications.restaurantId, restaurantId),
        eq(notifications.dedupeKey, dedupeKey),
        ne(notifications.status, "resolved"),
      ),
    )
    .returning({ id: notifications.id });
  return rows.length > 0;
}
