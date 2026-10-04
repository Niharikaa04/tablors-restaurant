import Link from "next/link";
import { getOrders, getTables } from "@/server/modules/demo-store/store";
import { StatusPill } from "./status-pill";
import { SectionHeader } from "./section-header";

export function RecentOrdersTable() {
  const tables = getTables();
  const orders = [...getOrders()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader title="Recent Orders" href="/owner/orders" />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-[var(--ov-muted)]">
              <th className="pb-2 font-medium">Order</th>
              <th className="pb-2 font-medium">Table</th>
              <th className="pb-2 font-medium">Items</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 pr-0 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const table = tables.find((t) => t.id === order.tableId);
              const total = order.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);
              const itemCount = order.lines.reduce((sum, l) => sum + l.qty, 0);
              // Billed orders no longer appear on the live Orders list, so
              // there's nowhere meaningful to deep-link them — send those
              // rows to Billing (where they do show up) instead.
              const href = order.status === "billed" ? "/owner/billing" : `/owner/orders#${order.id}`;

              return (
                <tr
                  key={order.id}
                  className="group border-t border-[var(--ov-border)] transition-colors hover:bg-[var(--ov-icon-surface)]"
                >
                  <td className="p-0">
                    <Link href={href} className="block py-2.5 pl-0 text-[var(--ov-text-secondary)]">
                      #{order.id}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={href} className="block py-2.5 text-[var(--ov-text)]">
                      {table?.label ?? order.tableId}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={href} className="block py-2.5 text-[var(--ov-text-secondary)]">
                      {itemCount}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={href} className="block py-2.5">
                      <StatusPill status={order.status} />
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={href} className="block py-2.5 text-[var(--ov-text-secondary)]">
                      {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Link>
                  </td>
                  <td className="p-0">
                    <Link href={href} className="block py-2.5 pr-0 text-right text-[var(--ov-text)]">
                      ₹{total}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--ov-muted)]">
                  No orders yet today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
