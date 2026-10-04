"use client";

import { useEffect, useState } from "react";
import { ChefHat, LogOut, Search } from "lucide-react";
import type { RestaurantTable } from "@/server/modules/demo-store/store";

export function KitchenHeader({
  tables,
  search,
  onSearchChange,
  tableFilter,
  onTableFilterChange,
  signOutAction,
}: {
  tables: RestaurantTable[];
  search: string;
  onSearchChange: (value: string) => void;
  tableFilter: string;
  onTableFilterChange: (value: string) => void;
  signOutAction: () => Promise<void>;
}) {
  // Client-only ticking clock, same pattern as the owner Overview
  // header: starts blank so server and first client render match.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dateLabel = now?.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = now?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--kd-border)] bg-[var(--kd-surface)]">
            <ChefHat className="h-5 w-5 text-[var(--kd-accent)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--kd-text)]">
              Kitchen <span className="text-[var(--kd-accent)]">Display</span>
            </h1>
            <p className="mt-0.5 text-xs text-[var(--kd-text-secondary)]">
              Live kitchen orders &middot; Prepare and update order status
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface)] px-3.5 py-2 text-xs text-[var(--kd-text-secondary)]">
            <span className="tabular-nums" suppressHydrationWarning>
              {dateLabel && timeLabel ? `${dateLabel} \u00B7 ${timeLabel}` : "\u00A0"}
            </span>
          </div>
          <div className="rounded-lg border border-[var(--kd-ready)]/40 bg-[var(--kd-ready)]/10 px-3.5 py-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--kd-ready)]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--kd-ready)] animate-pulse"
                style={{ boxShadow: "0 0 8px var(--kd-ready)" }}
              />
              Kitchen Online
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--kd-text-secondary)]">All systems running</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface)] px-3.5 py-2 text-xs text-[var(--kd-text-secondary)] transition-colors hover:border-[var(--kd-error)]/50 hover:text-[var(--kd-error)]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--kd-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search order, table or item..."
            className="w-full rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--kd-text)] placeholder:text-[var(--kd-muted)] outline-none focus-visible:border-[var(--kd-accent)]"
          />
        </div>

        <select
          value={tableFilter}
          onChange={(e) => onTableFilterChange(e.target.value)}
          aria-label="Filter by table"
          className="rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface)] px-3.5 py-2.5 text-sm text-[var(--kd-text)] outline-none focus-visible:border-[var(--kd-accent)] sm:w-48"
        >
          <option value="all">All Tables</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
