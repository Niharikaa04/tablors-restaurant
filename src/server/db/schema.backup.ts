import { sql } from "drizzle-orm";

import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * PostgreSQL foundation for Tablor's.
 *
 * This schema replaces the Phase-1 in-memory demo store as the persistent
 * source of truth. IDs intentionally remain text-compatible with the
 * existing demo code so the migration can be incremental.
 *
 * Money is stored as integer paise. Timestamps are UTC.
 */

export const userRole = pgEnum("user_role", [
  "owner",
  "manager",
  "cashier",
  "kitchen",
  "admin",
]);

export const tableStatus = pgEnum("table_status", [
  "available",
  "occupied",
  "reserved",
]);

export const orderStatus = pgEnum("order_status", [
  "new",
  "preparing",
  "ready",
  "served",
  "billed",
  "cancelled",
]);

export const reservationStatus = pgEnum("reservation_status", [
  "booked",
  "checked_in",
  "cancelled",
]);

export const paymentMethod = pgEnum("payment_method", [
  "cash",
  "upi",
  "card",
]);

export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "partial",
  "paid",
  "refunded",
]);

export const deviceStatus = pgEnum("device_status", [
  "online",
  "offline",
]);

export const restaurants = pgTable("restaurants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name"),
  phone: text("phone"),
  email: text("email"),
  city: text("city"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    role: userRole("role").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    pinHash: text("pin_hash"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_restaurant_idx").on(t.restaurantId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    restaurantId: text("restaurant_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_restaurant_idx").on(t.restaurantId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

export const areas = pgTable(
  "areas",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("areas_restaurant_name_unique").on(t.restaurantId, t.name),
    index("areas_restaurant_idx").on(t.restaurantId),
  ],
);

export const restaurantTables = pgTable(
  "tables",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    areaId: text("area_id"),
    label: text("label").notNull(),
    number: integer("number"),
    status: tableStatus("status").notNull().default("available"),
    currentOrderId: text("current_order_id"),
    waiterCalled: boolean("waiter_called").notNull().default(false),
    waiterCalledAt: timestamp("waiter_called_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tables_restaurant_number_unique").on(t.restaurantId, t.number),
    index("tables_restaurant_idx").on(t.restaurantId),
    index("tables_area_idx").on(t.areaId),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("categories_restaurant_name_unique").on(t.restaurantId, t.name),
    index("categories_restaurant_idx").on(t.restaurantId),
  ],
);

export const menuItems = pgTable(
  "menu_items",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    categoryId: text("category_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    pricePaise: integer("price_paise").notNull(),
    veg: boolean("veg").notNull().default(false),
    available: boolean("available").notNull().default(true),
    prepMinutes: integer("prep_minutes").notNull().default(0),
    isSpecial: boolean("is_special").notNull().default(false),
    discountPercent: integer("discount_percent").notNull().default(0),
    imageMime: text("image_mime"),
    imageData: text("image_data"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("menu_items_active_code_unique")
      .on(t.restaurantId, t.code)
      .where(sql`${t.archivedAt} IS NULL`),
    index("menu_items_restaurant_idx").on(t.restaurantId),
    index("menu_items_category_idx").on(t.categoryId),
  ],
);

export const tableSessions = pgTable(
  "table_sessions",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    tableId: text("table_id").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    index("table_sessions_restaurant_idx").on(t.restaurantId),
    index("table_sessions_table_idx").on(t.tableId),
  ],
);

export const devices = pgTable(
  "devices",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    deviceUid: text("device_uid").notNull(),
    secretHash: text("secret_hash"),
    tableId: text("table_id"),
    status: deviceStatus("status").notNull().default("offline"),
    batteryPercent: integer("battery_percent"),
    firmwareVersion: text("firmware_version"),
    signal: text("signal"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("devices_uid_unique").on(t.deviceUid),
    index("devices_restaurant_idx").on(t.restaurantId),
    index("devices_table_idx").on(t.tableId),
  ],
);

export const deviceHeartbeats = pgTable(
  "device_heartbeats",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    deviceId: text("device_id").notNull(),
    batteryPercent: integer("battery_percent"),
    signal: text("signal"),
    firmwareVersion: text("firmware_version"),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("device_heartbeats_device_idx").on(t.deviceId, t.seenAt),
    index("device_heartbeats_restaurant_idx").on(t.restaurantId, t.seenAt),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    sessionId: text("session_id"),
    tableId: text("table_id").notNull(),
    deviceId: text("device_id"),
    status: orderStatus("status").notNull().default("new"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("orders_restaurant_created_idx").on(t.restaurantId, t.createdAt),
    index("orders_table_idx").on(t.tableId, t.createdAt),
    index("orders_status_idx").on(t.restaurantId, t.status),
    uniqueIndex("orders_device_idempotency_unique")
      .on(t.deviceId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id").notNull(),
    menuItemId: text("menu_item_id"),
    code: text("code").notNull(),
    nameSnapshot: text("name_snapshot").notNull(),
    categorySnapshot: text("category_snapshot"),
    qty: integer("qty").notNull(),
    pricePaise: integer("price_paise").notNull(),
    basePricePaise: integer("base_price_paise"),
    discountPercent: integer("discount_percent"),
    prepMinutes: integer("prep_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_menu_item_idx").on(t.menuItemId),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    orderId: text("order_id").notNull(),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    actorUserId: text("actor_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("order_events_order_idx").on(t.orderId, t.createdAt),
    index("order_events_restaurant_idx").on(t.restaurantId, t.createdAt),
  ],
);

export const reservations = pgTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    tableId: text("table_id").notNull(),
    guestName: text("guest_name").notNull(),
    phone: text("phone").notNull(),
    partySize: integer("party_size").notNull(),
    reservedFor: timestamp("reserved_for", { withTimezone: true }).notNull(),
    status: reservationStatus("status").notNull().default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reservations_restaurant_time_idx").on(t.restaurantId, t.reservedFor),
    index("reservations_table_time_idx").on(t.tableId, t.reservedFor),
  ],
);

export const bills = pgTable(
  "bills",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    orderId: text("order_id").notNull(),
    tableId: text("table_id").notNull(),
    subtotalPaise: integer("subtotal_paise").notNull(),
    gstPaise: integer("gst_paise").notNull().default(0),
    discountPaise: integer("discount_paise").notNull().default(0),
    serviceChargePaise: integer("service_charge_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    paymentMethod: paymentMethod("payment_method"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bills_order_unique").on(t.orderId),
    index("bills_restaurant_idx").on(t.restaurantId, t.createdAt),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    billId: text("bill_id").notNull(),
    method: paymentMethod("method").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    status: paymentStatus("status").notNull().default("unpaid"),
    transactionId: text("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("payments_bill_idx").on(t.billId),
    index("payments_restaurant_idx").on(t.restaurantId, t.createdAt),
  ],
);

export const waiterCalls = pgTable(
  "waiter_calls",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    tableId: text("table_id").notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }).defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: text("acknowledged_by"),
  },
  (t) => [
    index("waiter_calls_restaurant_idx").on(t.restaurantId, t.calledAt),
    index("waiter_calls_table_idx").on(t.tableId, t.calledAt),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: text("id").primaryKey(),
    restaurantName: text("restaurant_name").notNull(),
    ownerName: text("owner_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull(),
    city: text("city").notNull(),
    tableCount: integer("table_count").notNull(),
    restaurantType: text("restaurant_type").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("leads_received_idx").on(t.receivedAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id"),
    userId: text("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_restaurant_created_idx").on(t.restaurantId, t.createdAt),
    index("audit_entity_idx").on(t.entityType, t.entityId),
  ],
);

// Existing notification schema retained.
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
    id: text("id").primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    type: text("type").notNull(),
    priority: notifPriority("priority").notNull(),
    targetRoles: text("target_roles").array().notNull(),
    tableId: text("table_id"),
    orderId: text("order_id"),
    deviceId: text("device_id"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    dedupeKey: text("dedupe_key"),
    status: notifStatus("status").notNull().default("unread"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("notif_restaurant_created_idx").on(t.restaurantId, t.createdAt),
    index("notif_dedupe_idx").on(t.restaurantId, t.dedupeKey, t.status),
  ],
);

export const notificationPrefs = pgTable("notification_prefs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sound: boolean("sound").notNull().default(true),
  quietStart: text("quiet_start"),
  quietEnd: text("quiet_end"),
});
