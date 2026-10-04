"use client";

import type { MenuItem, Order, RestaurantTable } from "@/server/modules/demo-store/store";
import { KITCHEN_STATUS_META, type KitchenStatus } from "./kitchen-utils";
import { OrderCard } from "./order-card";

export function OrderColumn({
  status,
  orders,
  tablesById,
  menuByCode,
  now,
  selectedOrderId,
  onSelectOrder,
  advancingId,
  onAdvance,
  togglingCode,
  onToggleAvailability,
  sortDir,
  onChangeSortDir,
}: {
  status: KitchenStatus;
  orders: Order[];
  tablesById: Map<string, RestaurantTable>;
  menuByCode: Map<string, MenuItem>;
  now: number;
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  advancingId: string | null;
  onAdvance: (orderId: string) => void;
  togglingCode: string | null;
  onToggleAvailability: (code: string, nextAvailable: boolean) => void;
  sortDir: "asc" | "desc";
  onChangeSortDir: (dir: "asc" | "desc") => void;
}) {
  const meta = KITCHEN_STATUS_META[status];

  const sorted = [...orders].sort((a, b) =>
    sortDir === "asc" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
  );

  return (
    <div
      id={`kitchen-column-${status}`}
      className="flex min-h-[240px] flex-col rounded-xl border p-3.5"
      style={{
        borderColor: `color-mix(in srgb, var(${meta.colorVar}) 35%, var(--kd-border))`,
        background: "var(--kd-surface)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: `var(${meta.colorVar})` }}
          />
          <h2 className="text-sm font-semibold text-[var(--kd-text)]">
            {meta.title} <span className="text-[var(--kd-muted)]">({orders.length})</span>
          </h2>
        </div>

        <label className="sr-only" htmlFor={`sort-${status}`}>
          Sort {meta.title} orders
        </label>
        <select
          id={`sort-${status}`}
          value={sortDir}
          onChange={(e) => onChangeSortDir(e.target.value as "asc" | "desc")}
          className="rounded-md border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] px-2 py-1 text-[11px] text-[var(--kd-text-secondary)] outline-none focus-visible:border-[var(--kd-accent)]"
        >
          <option value="asc">Oldest First</option>
          <option value="desc">Latest First</option>
        </select>
      </div>
      <p className="mt-1 text-[11px] text-[var(--kd-muted)]">{meta.subtitle}</p>

      <div className="mt-3 flex-1 space-y-3">
        {sorted.length === 0 && (
          <p className="py-8 text-center text-xs text-[var(--kd-muted)]">Nothing here.</p>
        )}

        {sorted.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            status={status}
            table={tablesById.get(order.tableId)}
            menuByCode={menuByCode}
            now={now}
            isSelected={order.id === selectedOrderId}
            onSelect={() => onSelectOrder(order.id)}
            onAdvance={() => onAdvance(order.id)}
            isAdvancing={advancingId === order.id}
            togglingCode={togglingCode}
            onToggleAvailability={onToggleAvailability}
          />
        ))}
      </div>
    </div>
  );
}
