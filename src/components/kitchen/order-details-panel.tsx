"use client";

import { ClipboardList, StickyNote } from "lucide-react";
import type { MenuItem, Order, RestaurantTable } from "@/server/modules/demo-store/store";
import { KITCHEN_STATUS_META, formatElapsed, minutesSince } from "./kitchen-utils";
import { AvailabilityToggle } from "./availability-toggle";

export function OrderDetailsPanel({
  order,
  table,
  menuByCode,
  now,
  togglingCode,
  onToggleAvailability,
}: {
  order: Order | null;
  table: RestaurantTable | undefined;
  menuByCode: Map<string, MenuItem>;
  now: number;
  togglingCode: string | null;
  onToggleAvailability: (code: string, nextAvailable: boolean) => void;
}) {
  if (!order) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border border-[var(--kd-border)] bg-[var(--kd-surface)] p-6 text-center">
        <ClipboardList className="h-5 w-5 text-[var(--kd-muted)]" />
        <p className="text-sm text-[var(--kd-text-secondary)]">Select an order to view details.</p>
      </div>
    );
  }

  // Literal check (rather than the isKitchenStatus() guard) so the
  // narrowing on order.status is unambiguous to the compiler here.
  const statusLabel =
    order.status === "billed" ? "Billed" : KITCHEN_STATUS_META[order.status].title;
  const statusAgeMinutes = minutesSince(order.statusUpdatedAt, now);

  return (
    <div className="rounded-xl border border-[var(--kd-accent)]/50 bg-[var(--kd-surface)] p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[var(--kd-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--kd-text)]">Order Details</h2>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] px-3.5 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-[var(--kd-text)]">#{order.id}</span>
            <span className="rounded-full border border-[var(--kd-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--kd-text-secondary)]">
              {table?.label ?? order.tableId}
            </span>
            <span className="rounded-full border border-[var(--kd-border)] px-2 py-0.5 text-[10px] text-[var(--kd-muted)]">
              Dine In
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--kd-text-secondary)]">
            Status: {statusLabel} &middot; {formatElapsed(statusAgeMinutes * 60000)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        {order.lines.map((line) => {
          const item = menuByCode.get(line.itemId ?? line.code);
          return (
            <div
              key={line.code}
              className="flex items-center justify-between gap-3 border-b border-[var(--kd-border)] pb-2.5 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--kd-text)]">{line.name}</p>
                <p className="text-[11px] text-[var(--kd-muted)]">{line.qty} &times;</p>
              </div>
              {item && (
                <AvailabilityToggle
                  available={item.available}
                  pending={togglingCode === item.code}
                  onToggle={(next) => onToggleAvailability(item.code, next)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-start gap-2 rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] px-3.5 py-3">
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--kd-muted)]" />
        <div>
          <p className="text-xs font-medium text-[var(--kd-text)]">Special Instructions</p>
          {/* The order model has no notes/instructions field today —
              showing this honestly rather than inventing one. */}
          <p className="mt-0.5 text-[11px] text-[var(--kd-muted)]">No special instructions.</p>
        </div>
      </div>
    </div>
  );
}
