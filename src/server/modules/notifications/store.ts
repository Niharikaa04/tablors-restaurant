// src/server/modules/notifications/store.ts

import { EventEmitter } from "node:events";

import {
  NOTIFICATION_TYPES,
  type Notification,
  type NotifyInput,
  type Role,
  type Status,
} from "./types";

type NotificationState = {
  items: Notification[];
  bus: EventEmitter;
};

const globalState = globalThis as typeof globalThis & {
  __tablorsNotifications?: NotificationState;
};

const state =
  globalState.__tablorsNotifications ??
  (globalState.__tablorsNotifications = {
    items: [],
    bus: new EventEmitter(),
  });

state.bus.setMaxListeners(0);

export const notificationBus = state.bus;

export function notify(input: NotifyInput): Notification {
  const config = NOTIFICATION_TYPES[input.type];

  // Prevent duplicate notifications when a dedupe key is supplied.
  if (input.dedupeKey) {
    const existing = state.items.find(
      (item) =>
        item.dedupeKey === input.dedupeKey &&
        item.status !== "resolved",
    );

    if (existing) {
      return existing;
    }
  }

  const notification: Notification = {
    id: crypto.randomUUID(),
    type: input.type,
    priority: input.priorityOverride ?? config.priority,
    targetRoles: [...config.roles],
    title: input.title,
    message: input.message,
    tableId: input.tableId,
    orderId: input.orderId,
    deviceId: input.deviceId,
    dedupeKey: input.dedupeKey,
    status: "unread",
    createdAt: new Date().toISOString(),
  };

  state.items.unshift(notification);

  // Keep the demo store from growing forever.
  if (state.items.length > 200) {
    state.items.length = 200;
  }

  // Notify connected SSE clients.
  state.bus.emit("new", notification);

  return notification;
}

export function listFor(
  role: Role,
  type?: string | null,
): Notification[] {
  return state.items.filter((notification) => {
    const matchesRole = notification.targetRoles.includes(role);

    const matchesType =
      !type || notification.type === type;

    return matchesRole && matchesType;
  });
}

export function setStatus(
  id: string,
  role: Role,
  status: Status,
): boolean {
  const notification = state.items.find(
    (item) =>
      item.id === id &&
      item.targetRoles.includes(role),
  );

  if (!notification) {
    return false;
  }

  notification.status = status;

  if (status === "resolved") {
    notification.resolvedAt = new Date().toISOString();
  } else {
    delete notification.resolvedAt;
  }

  return true;
}

export function resolveByKey(
  dedupeKey: string,
): boolean {
  const notification = state.items.find(
    (item) =>
      item.dedupeKey === dedupeKey &&
      item.status !== "resolved",
  );

  if (!notification) {
    return false;
  }

  notification.status = "resolved";
  notification.resolvedAt = new Date().toISOString();

  return true;
}