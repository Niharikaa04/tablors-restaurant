// src/lib/notifications/types.ts

import { z } from "zod";

export type Role =
  | "owner"
  | "manager"
  | "cashier"
  | "kitchen"
  | "waiter"
  | "admin";

export type Priority = "low" | "medium" | "high" | "critical";

export type Status =
  | "unread"
  | "read"
  | "acknowledged"
  | "resolved";

export const NOTIFICATION_TYPES = {
  ORDER_NEW: {
    roles: ["kitchen", "owner"],
    priority: "high",
    autoResolve: false,
  },

  PAYMENT_RECEIVED: {
    roles: ["owner", "cashier"],
    priority: "medium",
    autoResolve: false,
  },

  ITEM_UNAVAILABLE: {
    roles: ["owner", "kitchen"],
    priority: "high",
    autoResolve: false,
  },

  TABLE_RESERVED: {
    roles: ["owner", "waiter", "manager"],
    priority: "medium",
    autoResolve: false,
  },

  ORDER_CANCELLED: {
    roles: ["kitchen", "owner"],
    priority: "high",
    autoResolve: false,
  },

  DEVICE_OFFLINE: {
    roles: ["owner", "admin"],
    priority: "high",
    autoResolve: true,
  },

  DEVICE_LOW_BATTERY: {
    roles: ["owner", "admin"],
    priority: "medium",
    autoResolve: true,
  },

  KITCHEN_ORDER_DELAYED: {
    roles: ["owner", "manager"],
    priority: "high",
    autoResolve: true,
  },
} as const satisfies Record<
  string,
  {
    roles: readonly Role[];
    priority: Priority;
    autoResolve: boolean;
  }
>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

const NOTIFICATION_TYPE_KEYS = Object.keys(
  NOTIFICATION_TYPES,
) as [NotificationType, ...NotificationType[]];

/**
 * Only ORDER_NEW can be created without an authenticated session.
 * This is useful for the customer ordering flow in the demo.
 */
export const PUBLIC_TYPES: readonly NotificationType[] = [
  "ORDER_NEW",
];

// Thresholds: move these to per-restaurant settings later
export const THRESHOLDS = {
  OFFLINE_AFTER_MIN: 3,
  LOW_BATTERY_PCT: 20,
  CRITICAL_BATTERY_PCT: 10,
  KITCHEN_DELAY_MIN: 15,
};

export const notifyInput = z.object({
  type: z.enum(NOTIFICATION_TYPE_KEYS),

  title: z.string().min(1).max(120),

  message: z.string().min(1).max(400),

  // Demo uses normal string IDs, not UUIDs.
  tableId: z.string().max(60).optional(),

  orderId: z.string().max(60).optional(),

  deviceId: z.string().max(60).optional(),

  dedupeKey: z.string().max(120).optional(),

  priorityOverride: z
    .enum(["low", "medium", "high", "critical"])
    .optional(),
});

export type NotifyInput = z.infer<typeof notifyInput>;

export type Notification = {
  id: string;

  type: NotificationType;

  priority: Priority;

  targetRoles: Role[];

  title: string;

  message: string;

  tableId?: string;

  orderId?: string;

  deviceId?: string;

  dedupeKey?: string;

  status: Status;

  createdAt: string;

  resolvedAt?: string;
};