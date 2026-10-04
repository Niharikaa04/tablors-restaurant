import { AlertTriangle, ChefHat, CheckCircle2, Clock } from "lucide-react";
import { getSlowActiveOrders, getTodayOverview } from "@/server/modules/demo-store/store";
import { runNotificationSweep } from "@/server/modules/notifications/sweep";
import { SectionHeader } from "./section-header";

export function KitchenStatusPanel() {
  runNotificationSweep();

  const overview = getTodayOverview();
  const slowOrders = getSlowActiveOrders();

  const rows = [
    { label: "New", value: overview.newOrders, icon: Clock },
    { label: "Preparing", value: overview.preparingOrders, icon: ChefHat },
    { label: "Ready", value: overview.readyOrders, icon: CheckCircle2 },
  ];

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader title="Kitchen" subtitle="Live ticket status" href="/kitchen" hrefLabel="Open kitchen" />

      <div className="mt-4 grid grid-cols-3 gap-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] p-3 text-center">
            <row.icon className="mx-auto h-4 w-4 text-[var(--ov-text-secondary)]" />
            <p className="mt-1.5 text-lg font-bold text-[var(--ov-text)]">{row.value}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--ov-muted)]">{row.label}</p>
          </div>
        ))}
      </div>

      {slowOrders.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--ov-gold)]/30 bg-[var(--ov-gold)]/[0.06] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ov-gold)]" />
          <p className="text-xs text-[var(--ov-gold)]">
            {slowOrders.length} order{slowOrders.length === 1 ? "" : "s"} taking longer than expected
          </p>
        </div>
      )}
    </div>
  );
}