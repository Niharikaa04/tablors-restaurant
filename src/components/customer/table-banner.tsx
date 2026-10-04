import type { RestaurantTable } from "@/server/modules/demo-store/store";

/**
 * Identifies which table this menu session belongs to. Read-only display
 * of existing table state — Feature 2 is identification, not ordering,
 * so this never lets the customer change status or pick a table.
 */
export function TableBanner({ table }: { table: RestaurantTable }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] px-4 py-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-[var(--tablor-text-muted)]">
          You&apos;re viewing the menu for
        </p>
        <p className="mt-0.5 text-lg font-semibold text-[var(--tablor-text-primary)]">
          {table.label}
        </p>
      </div>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--tablor-accent)]" />
    </div>
  );
}