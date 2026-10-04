import { listFor } from "@/server/modules/notifications/store";
import { setNotificationLoader } from "@/server/modules/notifications/feed";

const TYPE_MAP = {
  ORDER_NEW: "order_new",
  PAYMENT_RECEIVED: "payment_received",
  ITEM_UNAVAILABLE: "item_unavailable",
  TABLE_RESERVED: "table_reserved",
  ORDER_CANCELLED: "order_cancelled",
  DEVICE_OFFLINE: "device_offline",
  DEVICE_LOW_BATTERY: "device_low_battery",
  KITCHEN_ORDER_DELAYED: "kitchen_order_delayed",
} as const;

setNotificationLoader(async () => {
  const notifications = listFor("owner", null);

  return notifications.map((n) => ({
    id: n.id,
    type: TYPE_MAP[n.type as keyof typeof TYPE_MAP] ?? "order_new",
    message: n.message,
    at: new Date(n.createdAt),
    read: n.status !== "unread",
  }));
});