"use client";

import { ClipboardList, Inbox, ChefHat, BellRing, CheckCircle2, type LucideIcon } from "lucide-react";
import { KITCHEN_STATUSES, KITCHEN_STATUS_META, type KitchenStatus } from "./kitchen-utils";

const ICONS: Record<KitchenStatus, LucideIcon> = {
  new: Inbox,
  preparing: ChefHat,
  ready: BellRing,
  served: CheckCircle2,
};

export function OrderSummaryStrip({
  counts,
  total,
  activeFilter,
  onSelectFilter,
}: {
  counts: Record<KitchenStatus, number>;
  total: number;
  activeFilter: KitchenStatus | "all";
  onSelectFilter: (status: KitchenStatus | "all") => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <button
        type="button"
        onClick={() => onSelectFilter("all")}
        aria-pressed={activeFilter === "all"}
        className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
          activeFilter === "all"
            ? "border-[var(--kd-accent)] bg-[var(--kd-surface-raised)]"
            : "border-[var(--kd-border)] bg-[var(--kd-surface)] hover:border-[var(--kd-accent)]/40"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--kd-accent)]/15 text-[var(--kd-accent)]">
          <ClipboardList className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-lg font-bold leading-none text-[var(--kd-text)]">{total}</span>
          <span className="mt-1 block text-[11px] text-[var(--kd-muted)]">Total Orders</span>
        </span>
      </button>

      {KITCHEN_STATUSES.map((status) => {
        const meta = KITCHEN_STATUS_META[status];
        const Icon = ICONS[status];
        const isActive = activeFilter === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelectFilter(status)}
            aria-pressed={isActive}
            className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
              isActive
                ? "bg-[var(--kd-surface-raised)]"
                : "border-[var(--kd-border)] bg-[var(--kd-surface)] hover:border-[var(--kd-text-secondary)]/40"
            }`}
            style={isActive ? { borderColor: `var(${meta.colorVar})` } : undefined}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: `color-mix(in srgb, var(${meta.colorVar}) 18%, transparent)`,
                color: `var(${meta.colorVar})`,
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-lg font-bold leading-none text-[var(--kd-text)]">
                {counts[status]}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--kd-muted)]">{meta.title}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
