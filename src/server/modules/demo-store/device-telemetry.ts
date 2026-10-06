/**
 * DEMO device telemetry helpers for /owner/devices.
 *
 * The real hardware protocol is NOT confirmed. Firmware version, wireless
 * signal, last synchronization and the TBLR-### device code are SIMULATED
 * demo values, derived deterministically from the existing device record
 * (no random values, no second device store). If the store's device record
 * later carries any of these fields (deviceCode, firmwareVersion, signal,
 * lastSyncMinutesAgo), the real value wins automatically.
 */

export type SignalStrength = "Strong" | "Good" | "Weak" | "Unknown";
export type BatteryState = "Normal" | "Low" | "Critical";

export interface DeviceTelemetry {
  deviceCode: string;
  firmwareVersion: string;
  signal: SignalStrength;
  /** Last successful data/menu synchronization. Separate from last seen (heartbeat). */
  lastSyncMinutesAgo: number;
}

export type DeviceTelemetryOverrides = Partial<DeviceTelemetry>;

export interface DeviceTelemetryInput {
  id: string | number;
  online: boolean;
  lastSeenMinutesAgo: number;
}

const DEMO_FIRMWARE = "V1.2.0";
const DEMO_SIGNALS: readonly SignalStrength[] = ["Strong", "Good", "Weak"];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Above 30% Normal, 10-30% Low, below 10% Critical. */
export function batteryState(percent: number): BatteryState {
  if (percent < 10) return "Critical";
  if (percent <= 30) return "Low";
  return "Normal";
}

export function formatAgo(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "Unknown";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rem = Math.round(minutes % 60);
    return rem ? `${hours} h ${rem} min ago` : `${hours} h ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}

export function resolveTelemetry(
  device: DeviceTelemetryInput & DeviceTelemetryOverrides,
  index: number
): DeviceTelemetry {
  const h = hash(String(device.id));
  // Last sync is always at or before last seen, and kept as its own value.
  const simulatedSync =
    device.lastSeenMinutesAgo + (device.online ? 1 + (h % 4) : 5 + (h % 20));

  return {
    deviceCode: device.deviceCode ?? `TBLR-${String(index + 1).padStart(3, "0")}`,
    firmwareVersion: device.firmwareVersion ?? DEMO_FIRMWARE,
    signal: device.signal ?? (device.online ? DEMO_SIGNALS[h % DEMO_SIGNALS.length] : "Unknown"),
    lastSyncMinutesAgo: device.lastSyncMinutesAgo ?? simulatedSync,
  };
}