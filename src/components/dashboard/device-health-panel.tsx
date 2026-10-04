import { BatteryFull, BatteryLow, BatteryMedium, WifiOff } from "lucide-react";
import { getDevices, getTables } from "@/server/modules/demo-store/store";
import { SectionHeader } from "./section-header";

function batteryIcon(percent: number) {
  if (percent >= 60) return BatteryFull;
  if (percent >= 25) return BatteryMedium;
  return BatteryLow;
}

export function DeviceHealthPanel() {
  const devices = getDevices();
  const tables = getTables();
  const offline = devices.filter((d) => !d.online).length;

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader
        title="Device health"
        subtitle={`${devices.length - offline}/${devices.length} online${offline > 0 ? ` · ${offline} offline` : ""}`}
        href="/owner/devices"
        hrefLabel="Manage devices"
      />

      <div className="mt-4 space-y-2">
        {devices.map((device) => {
          const table = tables.find((t) => t.id === device.tableId);
          const BatteryIcon = batteryIcon(device.batteryPercent);

          return (
            <div
              key={device.id}
              className="flex items-center justify-between rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-[var(--ov-gold)]">{table?.label ?? device.tableId}</span>
                {!device.online && <WifiOff className="h-3.5 w-3.5 text-[var(--ov-muted)]" />}
              </div>

              <div className="flex items-center gap-2 text-[11px]">
                {device.online ? (
                  <span className="flex items-center gap-1 text-[var(--ov-text-secondary)]">
                    <BatteryIcon className="h-3.5 w-3.5" />
                    {device.batteryPercent}%
                  </span>
                ) : (
                  <span className="text-[var(--ov-muted)]">Last seen {device.lastSeenMinutesAgo} min ago</span>
                )}
                <span className={`h-1.5 w-1.5 rounded-full ${device.online ? "bg-[var(--ov-accent)]" : "bg-[var(--ov-muted)]"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
