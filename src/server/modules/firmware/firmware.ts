/**
 * Firmware update (OTA) architecture — DESIGN ONLY, NOT ACTIVE IN V1.
 *
 * Nothing here talks to hardware. The real device protocol (transport,
 * image format, flash layout, rollback) has not been confirmed, so no
 * update can be started. These types and rules exist so the data model,
 * UI and permissions are shaped for OTA from day one.
 *
 * Intended model (when activated):
 *  - Releases belong to the PLATFORM (Tablor company admin publishes them),
 *    not to a restaurant. A restaurant only approves/schedules updates for
 *    its OWN devices.
 *  - Pull, not push: a device asks for updates during its normal heartbeat
 *    ("anything newer than V1.2.0?") and the server answers with the target
 *    version, download location, checksum and signature. This works behind
 *    restaurant Wi-Fi/NAT without opening inbound connections to devices.
 *  - Images are signed; the device verifies checksum + signature before
 *    installing and can roll back if the new image fails to boot.
 *  - Safety gates: device online, battery above a minimum, no update already
 *    running, release published and actually newer (see canStartUpdate).
 *  - Staged rollout (a few devices first), per-device status, audit log.
 */

/** Master switch. Keep false until the real hardware protocol is confirmed. */
export const OTA_ENABLED: boolean = false;

export const OTA_DISABLED_REASON =
  "Over-the-air updates are not enabled. The real hardware update protocol has not been confirmed.";

export type FirmwareReleaseStatus = "draft" | "published" | "withdrawn";

export interface FirmwareRelease {
  id: string;
  version: string; // e.g. "V1.3.0"
  status: FirmwareReleaseStatus;
  releasedAt: string | null;
  notes: string;
  /** Do not start an update below this battery level. */
  minBatteryPercent: number;
  /** Integrity + authenticity, verified by the device before install. */
  checksumSha256: string | null;
  signature: string | null;
}

export type FirmwareUpdateState =
  | "idle"
  | "scheduled"
  | "downloading"
  | "installing"
  | "verifying"
  | "succeeded"
  | "failed"
  | "rolled_back";

/** Per-device update status (keyed by the existing device id; no second device model). */
export interface DeviceFirmwareStatus {
  deviceId: string;
  currentVersion: string;
  targetVersion: string | null;
  state: FirmwareUpdateState;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface FirmwareRollout {
  id: string;
  releaseId: string;
  deviceIds: string[];
  createdBy: string;
  createdAt: string;
  status: "scheduled" | "running" | "completed" | "cancelled";
}

const BUSY_STATES: readonly FirmwareUpdateState[] = [
  "scheduled",
  "downloading",
  "installing",
  "verifying",
];

function parseVersion(version: string): number[] | null {
  const cleaned = version.trim().replace(/^v/i, "");
  if (!/^\d+(\.\d+)*$/.test(cleaned)) return null;
  return cleaned.split(".").map(Number);
}

/** Positive if a > b, negative if a < b, 0 if equal, null if either is not a valid version. */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return null;
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isUpdateAvailable(currentVersion: string, releaseVersion: string): boolean {
  const result = compareVersions(releaseVersion, currentVersion);
  return result !== null && result > 0;
}

export type UpdateCheck = { ok: true } | { ok: false; reason: string };

/**
 * The safety rules every update must pass. Pure function; the master switch
 * is injectable so the rules can be tested while V1 keeps OTA off.
 */
export function canStartUpdate(
  input: {
    device: {
      online: boolean;
      batteryPercent: number;
      currentVersion: string;
      state: FirmwareUpdateState;
    };
    release: Pick<FirmwareRelease, "version" | "status" | "minBatteryPercent">;
  },
  options: { otaEnabled?: boolean } = {}
): UpdateCheck {
  const enabled = options.otaEnabled ?? OTA_ENABLED;
  if (!enabled) return { ok: false, reason: OTA_DISABLED_REASON };

  const { device, release } = input;
  if (release.status !== "published") return { ok: false, reason: "This release is not published." };
  if (!isUpdateAvailable(device.currentVersion, release.version)) {
    return { ok: false, reason: "The device already has this version or a newer one." };
  }
  if (!device.online) return { ok: false, reason: "The device is offline." };
  if (device.batteryPercent < release.minBatteryPercent) {
    return { ok: false, reason: `Battery must be at least ${release.minBatteryPercent}% to update.` };
  }
  if (BUSY_STATES.includes(device.state)) {
    return { ok: false, reason: "An update is already in progress on this device." };
  }
  return { ok: true };
}