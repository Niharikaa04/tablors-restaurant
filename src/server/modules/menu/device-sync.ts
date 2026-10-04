/**
 * DEVICE-SYNC BOUNDARY — intentionally a no-op today.
 *
 * Table devices currently render the same canonical menu straight from
 * the shared store (getMenu()) whenever their page loads/refreshes, so
 * the application state they read is already correct after every owner
 * change. There is NO hardware push channel in this project yet (no
 * device transport, no MQTT/WebSocket, no device auth).
 *
 * When real hardware sync exists, implement it HERE and nowhere else:
 * every menu mutation (create/edit/delete/availability/price/discount/
 * special) already calls notifyDevicesOfMenuChange(), so no caller needs
 * to change. Do not report `delivered: true` until a real transport does.
 */

export type MenuChangeReason =
  | "item-created"
  | "item-updated"
  | "item-deleted"
  | "item-archived"
  | "availability-changed";

export type DeviceSyncResult = { delivered: false; reason: "no-device-transport" };

export async function notifyDevicesOfMenuChange(
  _change: { reason: MenuChangeReason; itemId: string }
): Promise<DeviceSyncResult> {
  return { delivered: false, reason: "no-device-transport" };
}
