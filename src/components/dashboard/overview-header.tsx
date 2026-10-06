"use client";

import { useSyncExternalStore } from "react";

// The clock is an external, ticking source, so it is read with
// useSyncExternalStore instead of setState-in-an-effect. On the server
// (and during hydration) the snapshot is null, so the markup matches
// exactly; the real time fills in right after hydration.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 10_000);
  return () => clearInterval(id);
}

// Rounded down to the minute so the snapshot is a stable primitive
// and the component only re-renders when the displayed minute changes.
function getMinute(): number | null {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

function getServerMinute(): number | null {
  return null;
}

export function OverviewHeader({ restaurantName = "Tablor's" }: { restaurantName?: string }) {
  const minute = useSyncExternalStore(subscribe, getMinute, getServerMinute);
  const now = minute === null ? null : new Date(minute);

  const dateLabel = now?.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeLabel = now?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ov-text)] sm:text-[28px]">
          Welcome back, <span className="text-[var(--ov-gold)]">Owner</span>
        </h1>
        <p className="mt-1.5 text-sm font-medium text-[var(--ov-text)]">Here&apos;s today&apos;s overview</p>
        <p className="mt-0.5 text-xs text-[var(--ov-text-secondary)]">
          Live view of your restaurant operations
        </p>
      </div>

      <div className="flex flex-col items-start gap-2.5 sm:items-end">
        <div className="rounded-lg border border-[var(--ov-border)] bg-[var(--ov-surface)] px-3.5 py-2 text-xs text-[var(--ov-text-secondary)]">
          <span className="tabular-nums" suppressHydrationWarning>
            {dateLabel && timeLabel ? `${dateLabel} · ${timeLabel}` : "\u00A0"}
          </span>
        </div>

        <div className="rounded-lg border border-[var(--ov-border)] bg-[var(--ov-surface)] px-3.5 py-2 text-right">
          <p className="text-xs font-semibold text-[var(--ov-text)]">{restaurantName}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--ov-accent)]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--ov-accent)] animate-pulse"
              style={{ boxShadow: "0 0 8px var(--ov-accent)" }}
            />
            Live Operations
          </p>
        </div>
      </div>
    </div>
  );
}