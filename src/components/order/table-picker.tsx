import Link from "next/link";
import type { RestaurantTable, TableStatus } from "@/server/modules/demo-store/store";

const STATUS_LABEL: Record<TableStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
};

export function TablePicker({ tables }: { tables: RestaurantTable[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((table) => (
        <TableCard key={table.id} table={table} />
      ))}
    </div>
  );
}

function TableCard({ table }: { table: RestaurantTable }) {
  const isAvailable = table.status === "available";

  const badge = (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${
        isAvailable
          ? "bg-[var(--tablor-accent)] text-[#0d0e0b]"
          : table.status === "occupied"
            ? "bg-[var(--tablor-icon-surface)] text-[var(--tablor-error)]"
            : "bg-[var(--tablor-icon-surface)] text-[var(--tablor-text-secondary)]"
      }`}
    >
      {STATUS_LABEL[table.status]}
    </span>
  );

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-medium text-[var(--tablor-text-primary)]">
          {table.label}
        </p>
        {badge}
      </div>

      <p
        className={`mt-4 text-sm ${
          isAvailable
            ? "text-[var(--tablor-text-secondary)]"
            : "text-[var(--tablor-text-muted)]"
        }`}
      >
        {isAvailable
          ? "Tap to view today's menu"
          : table.status === "occupied"
            ? "Currently seated — check back shortly"
            : "Reserved for another guest"}
      </p>
    </>
  );

  if (isAvailable) {
    return (
      <Link
        href={`/customer/${table.id}`}
        aria-label={`${table.label} — available, view menu`}
        className="block rounded-2xl border border-[var(--tablor-accent)] bg-[var(--tablor-card)] p-5 shadow-[0_0_0_1px_var(--tablor-accent)] transition-transform active:scale-[0.98]"
      >
        {cardBody}
      </Link>
    );
  }

  return (
    <div
      aria-disabled="true"
      aria-label={`${table.label} — ${STATUS_LABEL[table.status].toLowerCase()}, not selectable`}
      className="cursor-not-allowed rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] p-5 opacity-60"
    >
      {cardBody}
    </div>
  );
}