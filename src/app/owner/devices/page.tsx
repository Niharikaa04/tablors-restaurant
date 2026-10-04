import { requirePermission } from "@/server/modules/auth/session";
import { OTA_DISABLED_REASON, OTA_ENABLED } from "@/server/modules/firmware/firmware";
import {
  batteryState,
  formatAgo,
  resolveTelemetry,
  type BatteryState,
  type SignalStrength,
} from "@/server/modules/demo-store/device-telemetry";
import { getDevices, getTables } from "@/server/modules/demo-store/store";

const BATTERY_TEXT: Record<BatteryState, string> = {
  Normal: "text-[var(--color-text-muted)]",
  Low: "text-[var(--color-warning,#e0a63a)]",
  Critical: "text-[var(--color-danger)]",
};
const BATTERY_BAR: Record<BatteryState, string> = {
  Normal: "bg-[var(--color-success)]",
  Low: "bg-[var(--color-warning,#e0a63a)]",
  Critical: "bg-[var(--color-danger)]",
};
const SIGNAL_TEXT: Record<SignalStrength, string> = {
  Strong: "text-[var(--color-success)]",
  Good: "text-[var(--color-text-primary)]",
  Weak: "text-[var(--color-warning,#e0a63a)]",
  Unknown: "text-[var(--color-text-muted)]",
};

const cardClass =
  "rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5";

function SummaryCard({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: number;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className={cardClass}>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-2 text-2xl ${valueClass ?? "text-[var(--color-text-primary)]"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className={`text-right ${valueClass ?? "text-[var(--color-text-primary)]"}`}>{value}</dd>
    </div>
  );
}

export default async function DevicesPage() {
  // Same owner-portal permission model as the rest of /owner (server-side).
  await requirePermission("devices");

  const devices = getDevices();
  const tables = getTables();

  const total = devices.length;
  const onlineCount = devices.filter((d) => d.online).length;
  const offlineCount = total - onlineCount;
  const lowBatteryCount = devices.filter((d) => d.batteryPercent <= 30).length;
  const criticalCount = devices.filter((d) => d.batteryPercent < 10).length;

  return (
    <div>
      <h1 className="text-2xl text-[var(--color-text-primary)]">Devices</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Demo telemetry — the real heartbeat interval and offline threshold
        are configurable (see .env.example) and not yet confirmed against
        real hardware. Device ID, firmware, signal and last sync are
        simulated demo values until the real device protocol is confirmed.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Total Devices" value={total} />
        <SummaryCard label="Online" value={onlineCount} valueClass="text-[var(--color-success)]" />
        <SummaryCard
          label="Offline"
          value={offlineCount}
          valueClass={offlineCount > 0 ? "text-[var(--color-danger)]" : undefined}
        />
        <SummaryCard
          label="Low Battery"
          value={lowBatteryCount}
          hint={criticalCount > 0 ? `${criticalCount} critical (below 10%)` : "30% or below"}
          valueClass={lowBatteryCount > 0 ? "text-[var(--color-warning,#e0a63a)]" : undefined}
        />
      </div>

      {devices.length === 0 && (
        <p className="mt-8 text-sm text-[var(--color-text-muted)]">No devices registered yet.</p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {devices.map((device, index) => {
          const table = tables.find((t) => t.id === device.tableId);
          const telemetry = resolveTelemetry(device, index);
          const battery = batteryState(device.batteryPercent);
          const batteryWidth = Math.min(100, Math.max(0, device.batteryPercent));

          return (
            <div key={device.id} className={cardClass}>
              <p className="text-base text-[var(--color-text-primary)]">
                {table?.label ?? device.tableId}
              </p>
              <p
                className={`mt-1 text-xs ${
                  device.online ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                ● {device.online ? "Online" : "Offline"}
              </p>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Battery</span>
                  <span className={BATTERY_TEXT[battery]}>
                    {device.batteryPercent}% · {battery}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
                  role="progressbar"
                  aria-label="Battery level"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={batteryWidth}
                >
                  <div
                    className={`h-full rounded-full ${BATTERY_BAR[battery]}`}
                    style={{ width: `${batteryWidth}%` }}
                  />
                </div>
              </div>

              <dl className="mt-4 space-y-1.5 text-xs">
                <Row label="Device ID" value={telemetry.deviceCode} />
                <Row label="Firmware" value={telemetry.firmwareVersion} />
                <Row
                  label="Signal"
                  value={telemetry.signal}
                  valueClass={SIGNAL_TEXT[telemetry.signal]}
                />
                <Row label="Last seen" value={formatAgo(device.lastSeenMinutesAgo)} />
                <Row label="Last sync" value={formatAgo(telemetry.lastSyncMinutesAgo)} />
              </dl>

              <details className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs">
                <summary className="cursor-pointer select-none text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                  View Details
                </summary>
                <div className="mt-3 space-y-3">
                  <dl className="space-y-1.5">
                    <Row label="Available firmware" value="None published" />
                    <Row label="Update status" value={OTA_ENABLED ? "Idle" : "Not enabled"} />
                  </dl>
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-muted)] opacity-60"
                  >
                    Firmware update · Coming soon
                  </button>
                  <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                    {OTA_DISABLED_REASON}
                  </p>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}