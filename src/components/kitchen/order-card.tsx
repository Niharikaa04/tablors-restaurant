"use client";

import { Loader2 } from "lucide-react";
import type { MenuItem, Order, RestaurantTable } from "@/server/modules/demo-store/store";
import {
  KITCHEN_STATUS_META,
  type KitchenStatus,
  formatElapsed,
  minutesSince,
} from "./kitchen-utils";
import { AvailabilityToggle } from "./availability-toggle";

export function OrderCard({
  order,
  status,
  table,
  menuByCode,
  now,
  isSelected,
  onSelect,
  onAdvance,
  isAdvancing,
  togglingCode,
  onToggleAvailability,
}: {
  order: Order;
  status: KitchenStatus;
  table: RestaurantTable | undefined;
  menuByCode: Map<string, MenuItem>;
  now: number;
  isSelected: boolean;
  onSelect: () => void;
  onAdvance: () => void;
  isAdvancing: boolean;
  togglingCode: string | null;
  onToggleAvailability: (code: string, nextAvailable: boolean) => void;
}) {
  const meta = KITCHEN_STATUS_META[status];
  const orderAgeMinutes = minutesSince(order.createdAt, now);
  const statusAgeMinutes = minutesSince(order.statusUpdatedAt, now);

  const topRightLabel =
    status === "ready"
      ? `Ready ${formatElapsed(statusAgeMinutes * 60000)}`
      : status === "served"
        ? formatElapsed(statusAgeMinutes * 60000)
        : formatElapsed(orderAgeMinutes * 60000);

  // Preparing progress against the slowest item's real prep time — a
  // comparison against existing menu data, not a guessed duration.
  const expectedPrepMinutes =
    status === "preparing"
      ? order.lines.reduce((max, line) => {
          const item = menuByCode.get(line.itemId ?? line.code);
          return item ? Math.max(max, item.prepMinutes) : max;
        }, 0)
      : 0;
  const prepRatio = expectedPrepMinutes > 0 ? statusAgeMinutes / expectedPrepMinutes : 0;
  const isOverrunning = prepRatio >= 1;

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
        isSelected
          ? "border-[var(--kd-accent)] bg-[var(--kd-surface-raised)] shadow-[0_0_0_1px_var(--kd-accent)]"
          : "border-[var(--kd-border)] bg-[var(--kd-surface)] hover:border-[var(--kd-text-secondary)]/40"
      } ${status === "served" ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--kd-text)]">#{order.id}</span>
            <span className="rounded-full border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] px-2 py-0.5 text-[10px] font-medium text-[var(--kd-text-secondary)]">
              {table?.label ?? order.tableId}
            </span>
            <span className="rounded-full border border-[var(--kd-border)] px-2 py-0.5 text-[10px] text-[var(--kd-muted)]">
              Dine In
            </span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-[var(--kd-text-secondary)]">
          {topRightLabel}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {order.lines.map((line) => {
          const item = menuByCode.get(line.itemId ?? line.code);
          return (
            <li key={line.code} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-[var(--kd-text)]">
                {line.qty} &times; {line.name}
              </span>
              {item && (
                <span onClick={(e) => e.stopPropagation()}>
                  <AvailabilityToggle
                    size="sm"
                    available={item.available}
                    pending={togglingCode === item.code}
                    onToggle={(next) => onToggleAvailability(item.code, next)}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {status === "preparing" && expectedPrepMinutes > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[var(--kd-muted)]">
            <span>{Math.round(statusAgeMinutes)} min elapsed</span>
            <span>{expectedPrepMinutes} min target</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--kd-border)]">
            <div
              className="h-full rounded-full transition-[width]"
              style={{
                width: `${Math.min(100, prepRatio * 100)}%`,
                background: isOverrunning ? "var(--kd-error)" : "var(--kd-preparing)",
              }}
            />
          </div>
        </div>
      )}

      {status !== "served" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdvance();
          }}
          disabled={isAdvancing}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--kd-accent-ink)] transition-colors disabled:cursor-wait disabled:opacity-70"
          style={{ background: isAdvancing ? "var(--kd-accent-hover)" : "var(--kd-accent)" }}
        >
          {isAdvancing && <Loader2 className="h-4 w-4 animate-spin" />}
          {meta.action}
        </button>
      ) : (
        <div className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--kd-border)] py-2.5 text-sm font-medium text-[var(--kd-text-secondary)]">
          Served
        </div>
      )}
    </div>
  );
}
