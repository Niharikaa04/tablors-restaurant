import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";

export const notifPriority = pgEnum("notif_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const notifStatus = pgEnum("notif_status", [
  "unread",
  "read",
  "acknowledged",
  "resolved",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    restaurantId: text("restaurant_id").notNull(),

    type: text("type").notNull(),

    priority: notifPriority("priority").notNull(),

    targetRoles: text("target_roles").array().notNull(),

    tableId: uuid("table_id"),

    orderId: uuid("order_id"),

    deviceId: uuid("device_id"),

    title: text("title").notNull(),

    message: text("message").notNull(),

    dedupeKey: text("dedupe_key"),

    status: notifStatus("status").notNull().default("unread"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    readAt: timestamp("read_at"),

    resolvedAt: timestamp("resolved_at"),
  },
  (t) => [
    index("notif_restaurant_created_idx").on(
      t.restaurantId,
      t.createdAt
    ),

    index("notif_dedupe_idx").on(
      t.restaurantId,
      t.dedupeKey,
      t.status
    ),
  ]
);

export const notificationPrefs = pgTable("notification_prefs", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id").notNull(),

  type: text("type").notNull(),

  enabled: boolean("enabled").notNull().default(true),

  sound: boolean("sound").notNull().default(true),

  quietStart: text("quiet_start"),

  quietEnd: text("quiet_end"),
});