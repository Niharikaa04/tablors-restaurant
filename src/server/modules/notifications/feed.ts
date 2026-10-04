/**
 * Owner notification feed for the dashboard bell.
 * It shows the SAME notifications as the Notifications page: the bell must read from your existing notification store.
 * Connect it ONCE with `setNotificationLoader` (bottom of this file).
 */
export const NOTIFICATION_TYPES = [
  "order_new", "payment_received", "item_unavailable", "table_reserved",
  "order_cancelled", "device_offline", "device_low_battery", "kitchen_order_delayed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type Severity = "info" | "warning" | "critical";

/** What your existing store must give us per notification. `id` must be stable so "read" sticks. */
export interface StoredNotification { id: string; type: NotificationType; message: string; at: Date; read?: boolean }
export interface OwnerNotification extends StoredNotification { title: string; severity: Severity; href: string; read: boolean }

/** Title, urgency and where a click should take the owner, per type. */
export const TYPE_META: Record<NotificationType, { title: string; severity: Severity; href: string }> = {
  order_new: { title: "New order", severity: "warning", href: "/owner/orders" },
  payment_received: { title: "Payment received", severity: "info", href: "/owner/billing" },
  item_unavailable: { title: "Item unavailable", severity: "warning", href: "/owner/menu" },
  table_reserved: { title: "Table reserved", severity: "info", href: "/owner/reservations" },
  order_cancelled: { title: "Order cancelled", severity: "warning", href: "/owner/orders" },
  device_offline: { title: "Device offline", severity: "critical", href: "/owner/devices" },
  device_low_battery: { title: "Device low battery", severity: "warning", href: "/owner/devices" },
  kitchen_order_delayed: { title: "Kitchen order delayed", severity: "critical", href: "/owner/orders" },
};

export type NotificationLoader = (businessId: string) => StoredNotification[] | Promise<StoredNotification[]>;
const g = globalThis as unknown as { __tablorsNotifLoader?: NotificationLoader; __tablorsNotifRead?: Set<string> };
const readIds = (): Set<string> => (g.__tablorsNotifRead ??= new Set());

/** Register the function that returns the notifications your Notifications page already shows. */
export function setNotificationLoader(fn: NotificationLoader): void { g.__tablorsNotifLoader = fn; }

export async function getNotificationFeed(businessId: string, limit = 15) {
  const load = g.__tablorsNotifLoader;
  if (!load) return { unread: 0, items: [] as OwnerNotification[], connected: false as const };
  const local = readIds();
  const rows = await load(businessId);
  const items: OwnerNotification[] = rows
    .filter((n) => n.type in TYPE_META)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map((n) => ({ ...n, ...TYPE_META[n.type], read: !!n.read || local.has(n.id) }));
  return { unread: items.filter((n) => !n.read).length, items: items.slice(0, limit), connected: true as const };
}

/** Marks read in the bell's own state. If your store has a real "mark read", call it too (see route.ts). */
export async function markNotificationsRead(ids: string[] | "all", businessId: string): Promise<string[]> {
  const read = readIds();
  const target = ids === "all" ? (await getNotificationFeed(businessId, 500)).items.map((n) => n.id) : ids.filter((i) => typeof i === "string" && i.length < 100);
  for (const id of target) read.add(id);
  return target;
}

/*
 * CONNECT YOUR STORE — example (replace getNotifications with whatever your Notifications page calls):
 *
 *   import { getNotifications } from "@/server/modules/notifications-store";
 *   setNotificationLoader(async () => (await getNotifications()).map((n) => ({
 *     id: n.id, type: n.type, message: n.message, at: new Date(n.createdAt), read: n.read,
 *   })));
 */
