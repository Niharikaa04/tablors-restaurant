import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getSlowActiveOrdersDb } from "@/server/modules/data/analytics-db";
import { getDevicesDb } from "@/server/modules/data/devices-db";
import { getTablesDb } from "@/server/modules/data/tables-db";
import { batteryState } from "@/server/modules/demo-store/device-telemetry";
import { listFor, notify, resolveByKey } from "./store";

const KITCHEN = "kitchen-delayed:";
const OFFLINE = "device-offline:";
const LOW_BATTERY = "device-low:";

/**
 * Turns late kitchen orders, offline devices and low batteries into
 * notifications. Safe to call repeatedly: notify() skips unresolved
 * duplicates, and alerts are resolved once the condition clears.
 */
export async function runNotificationSweep(
  restaurantId: string = DEMO_RESTAURANT_ID,
): Promise<void> {
  // ---- Late kitchen orders ----
  const slow = await getSlowActiveOrdersDb(restaurantId);
  const slowIds = new Set(slow.map((s) => s.order.id));

  for (const { order, expectedMinutes, elapsedMinutes } of slow) {
    await notify({
      type: "KITCHEN_ORDER_DELAYED",
      title: "Kitchen order delayed",
      message: `An order has been waiting ${Math.round(elapsedMinutes)} min (expected ${expectedMinutes} min).`,
      orderId: order.id,
      dedupeKey: `${KITCHEN}${order.id}`,
    });
  }

  for (const n of await listFor("owner", "KITCHEN_ORDER_DELAYED")) {
    if (n.status !== "resolved" && n.orderId && !slowIds.has(n.orderId)) {
      await resolveByKey(`${KITCHEN}${n.orderId}`);
    }
  }

  // ---- Devices: offline + battery ----
  const tables = await getTablesDb(restaurantId);
  const offlineIds = new Set<string>();
  const lowBatteryIds = new Set<string>();

  for (const device of await getDevicesDb(restaurantId)) {
    const id = String(device.id);
    const label =
      tables.find((t) => t.id === device.tableId)?.label ?? device.tableId;

    if (!device.online) {
      offlineIds.add(id);
      await notify({
        type: "DEVICE_OFFLINE",
        title: "Device offline",
        message: `The device at ${label} is offline.`,
        tableId: device.tableId,
        deviceId: id,
        dedupeKey: `${OFFLINE}${id}`,
      });
    }

    const state = batteryState(device.batteryPercent);
    if (state !== "Normal") {
      lowBatteryIds.add(id);
      await notify({
        type: "DEVICE_LOW_BATTERY",
        title: state === "Critical" ? "Device battery critical" : "Device low battery",
        message: `The device at ${label} is at ${device.batteryPercent}% battery.`,
        tableId: device.tableId,
        deviceId: id,
        priorityOverride: state === "Critical" ? "critical" : undefined,
        dedupeKey: `${LOW_BATTERY}${id}`,
      });
    }
  }

  for (const n of await listFor("owner", "DEVICE_OFFLINE")) {
    if (n.status !== "resolved" && n.deviceId && !offlineIds.has(n.deviceId)) {
      await resolveByKey(`${OFFLINE}${n.deviceId}`);
    }
  }

  for (const n of await listFor("owner", "DEVICE_LOW_BATTERY")) {
    if (n.status !== "resolved" && n.deviceId && !lowBatteryIds.has(n.deviceId)) {
      await resolveByKey(`${LOW_BATTERY}${n.deviceId}`);
    }
  }
}