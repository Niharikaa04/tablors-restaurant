import Link from "next/link";
import { getOrders, getTables, type TableStatus } from "@/server/modules/demo-store/store";
import { SectionHeader } from "./section-header";

const STATUS_STYLES: Record<TableStatus, string> = {
  available: "border-[var(--ov-border)] text-[var(--ov-text-secondary)]",
  occupied: "border-[var(--ov-accent)]/40 bg-[var(--ov-accent)]/[0.06] text-[var(--ov-accent)]",
  reserved: "border-[var(--ov-gold)]/40 bg-[var(--ov-gold)]/[0.06] text-[var(--ov-gold)]",
};

export function TableStatusGrid() {
  const tables = getTables();
  const orders = getOrders();
  const occupied = tables.filter((t) => t.status === "occupied").length;

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader
        title="Table Status"
        subtitle={`${occupied} occupied of ${tables.length}`}
        href="/owner/tables"
      />

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tables.map((table) => {
          const order = table.currentOrderId ? orders.find((o) => o.id === table.currentOrderId) : null;
          const total = order ? order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0) : null;

          return (
            <Link
              key={table.id}
              href={`/owner/tables#${table.id}`}
              className={`rounded-lg border p-3 transition-transform hover:-translate-y-0.5 ${STATUS_STYLES[table.status]}`}
            >
              <p className="text-sm font-medium">{table.label}</p>
              <p className="mt-0.5 text-[11px] capitalize opacity-80">{table.status}</p>
              {order && (
                <p className="mt-1.5 text-[11px] text-[var(--ov-text-secondary)]">
                  {order.lines.length} item{order.lines.length === 1 ? "" : "s"} · ₹{total}
                </p>
              )}
              {table.waiterCalled && (
                <p className="mt-1.5 text-[11px] font-medium text-[var(--ov-gold)]">🔔 Waiter called</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
