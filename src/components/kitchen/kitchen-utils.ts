import type { OrderStatus } from "@/server/modules/demo-store/store";

/** The kitchen only ever works these four states — "billed" is an
 * owner/billing concern and never shown here. */
export const KITCHEN_STATUSES = ["new", "preparing", "ready", "served"] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export const KITCHEN_STATUS_META: Record<
  KitchenStatus,
  { title: string; subtitle: string; action: string; colorVar: string }
> = {
  new: {
    title: "Incoming",
    subtitle: "New orders waiting to be prepared",
    action: "Move to Preparing",
    colorVar: "--kd-incoming",
  },
  preparing: {
    title: "Preparing",
    subtitle: "Orders currently being prepared",
    action: "Mark as Ready",
    colorVar: "--kd-preparing",
  },
  ready: {
    title: "Ready",
    subtitle: "Orders ready for serving",
    action: "Mark as Served",
    colorVar: "--kd-ready",
  },
  served: {
    title: "Served",
    subtitle: "Recently served orders",
    action: "Served",
    colorVar: "--kd-served",
  },
};

/** Formats a millisecond duration as kitchen-friendly elapsed text. */
export function formatElapsed(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m ago`;
}

export function minutesSince(timestamp: number, now: number): number {
  return Math.max(0, (now - timestamp) / 60000);
}

/** True order status values kept for narrowing against store data. */
export function isKitchenStatus(status: OrderStatus): status is KitchenStatus {
  return status !== "billed";
}
