import { getOrders, getTables } from "@/server/modules/demo-store/store";
import { StatusPill } from "./status-pill";
import { SectionHeader } from "./section-header";

function timeAgo(createdAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

export function LiveOrdersPanel() {
  const tables = getTables();
  const orders = getOrders()
    .filter((o) => o.status !== "billed")
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader title="Live orders" subtitle={`${orders.length} active`} href="/owner/orders" />

      <div className="mt-4 space-y-2">
        {orders.length === 0 && (
          <p className="py-6 text-center text-sm text-[var(--ov-muted)]">No active orders right now.</p>
        )}

        {orders.slice(0, 6).map((order) => {
          const table = tables.find((t) => t.id === order.tableId);
          const total = order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);
          const itemCount = order.lines.reduce((sum, l) => sum + l.qty, 0);

          return (
            <div
              key={order.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-3.5 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--ov-text)]">{table?.label ?? order.tableId}</p>
                  <span className="text-[11px] text-[var(--ov-muted)]">#{order.id}</span>
                  {table?.waiterCalled && (
                    <span className="text-[11px] font-medium text-[var(--ov-gold)]">🔔 waiter</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--ov-text-secondary)]">
                  {itemCount} item{itemCount === 1 ? "" : "s"} · {timeAgo(order.createdAt)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium text-[var(--ov-text)]">₹{total}</span>
                <StatusPill status={order.status} pulse={order.status === "ready"} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
