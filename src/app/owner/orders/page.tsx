import Link from "next/link";

import { LiveRefresh } from "@/components/live/live-refresh";
import { getOrders, getTables } from "@/server/modules/demo-store/store";
import {
  acknowledgeWaiter,
  advanceOrderFromForm,
} from "@/server/modules/orders/actions";

// Orders live in server memory and change constantly — never prerender.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string }>;
};

function getStatusLabel(status: string): string {
  switch (status) {
    case "new":
      return "New";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "served":
      return "Served";
    case "billed":
      return "Billed";
    default:
      return status;
  }
}

function getNextActionLabel(status: string): string | null {
  switch (status) {
    case "new":
      return "Accept Order";
    case "preparing":
      return "Mark Ready";
    case "ready":
      return "Mark Served";
    default:
      return null;
  }
}

function getNoticeMessage(code: string | undefined): string | null {
  switch (code) {
    case "stale":
      return "That order was already updated by someone else. Showing its latest status.";
    case "served":
      return "That order is already served. Billing is a separate step — open Billing.";
    case "billed":
      return "That order has already been billed.";
    case "missing":
      return "That order no longer exists.";
    case "forbidden":
      return "You don't have permission to update orders.";
    case "invalid":
      return "That update request was invalid.";
    default:
      return null;
  }
}

function formatElapsed(fromMs: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - fromMs) / 60000));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${hours} h ago` : `${hours} h ${rest} min ago`;
}

export default async function LiveOrdersPage({ searchParams }: PageProps) {
  const { notice } = await searchParams;
  const noticeMessage = getNoticeMessage(
    typeof notice === "string" ? notice : undefined
  );

  const orders = getOrders()
    .filter((o) => o.status !== "billed")
    .sort((a, b) => a.createdAt - b.createdAt);
  const tables = getTables();
  const waiterCalls = tables.filter((t) => t.waiterCalled);

  return (
    <div>
      <LiveRefresh />

      <h1 className="text-2xl text-[var(--color-text-primary)]">
        Live orders
      </h1>

      {noticeMessage && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-brand)] border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-4 py-3">
          <p className="text-sm text-[var(--color-warning)]">{noticeMessage}</p>

          <Link
            href="/owner/orders"
            className="rounded-[var(--radius-brand)] border border-[var(--color-warning)] px-3 py-1.5 text-xs font-medium text-[var(--color-warning)]"
          >
            Dismiss
          </Link>
        </div>
      )}

      {waiterCalls.length > 0 && (
        <div className="mt-4 space-y-2">
          {waiterCalls.map((table) => (
            <div
              key={table.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-brand)] border border-[var(--color-gold-500)] bg-[var(--color-gold-500)]/10 px-4 py-3"
            >
              <p className="text-sm font-medium text-[var(--color-gold-500)]">
                🔔 Waiter called — {table.label}
              </p>
              <form action={acknowledgeWaiter.bind(null, table.id)}>
                <button
                  type="submit"
                  className="rounded-[var(--radius-brand)] border border-[var(--color-gold-500)] px-3 py-1.5 text-xs font-medium text-[var(--color-gold-500)]"
                >
                  Acknowledge
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {orders.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            No active orders right now.
          </p>
        )}

        {orders.map((order) => {
          const table = tables.find((t) => t.id === order.tableId);
          const action = getNextActionLabel(order.status);

          const total = order.lines.reduce(
            (sum, line) => sum + line.qty * line.priceRupees,
            0
          );

          return (
            <div
              key={order.id}
              id={order.id}
              className="scroll-mt-6 rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 target:border-[var(--color-gold-500)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base text-[var(--color-text-primary)]">
                    {table?.label ?? order.tableId}
                  </p>

                  <p className="text-xs text-[var(--color-text-muted)]">
                    Order #{order.id} · Status: {getStatusLabel(order.status)}
                    {table?.waiterCalled && (
                      <span className="ml-2 text-[var(--color-gold-500)]">
                        · 🔔 Waiter called
                      </span>
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Placed {formatElapsed(order.createdAt)}
                    {order.status !== "new" &&
                      ` · ${getStatusLabel(order.status)} ${formatElapsed(order.statusUpdatedAt)}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {table && (
                    <Link
                      href={`/owner/tables/${table.id}`}
                      className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] transition hover:border-[var(--color-text-muted)]"
                    >
                      View table
                    </Link>
                  )}

                  {action && (
                    <form action={advanceOrderFromForm}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input
                        type="hidden"
                        name="expectedStatus"
                        value={order.status}
                      />

                      <button
                        type="submit"
                        className="rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-4 py-2 text-xs font-medium text-[#0a0a0a]"
                      >
                        {action}
                      </button>
                    </form>
                  )}

                  {order.status === "served" && (
                    <Link
                      href={`/owner/billing?tableId=${order.tableId}`}
                      className="rounded-[var(--radius-brand)] border border-[var(--color-gold-500)] px-4 py-2 text-xs font-medium text-[var(--color-gold-500)]"
                    >
                      Go to billing →
                    </Link>
                  )}
                </div>
              </div>

              <ul className="mt-4 space-y-1 text-sm text-[var(--color-text-secondary)]">
                {order.lines.map((line) => (
                  <li key={line.code}>
                    {line.name} × {line.qty}
                  </li>
                ))}
              </ul>

              <p className="mt-3 text-sm text-[var(--color-text-primary)]">
                ₹{total.toLocaleString("en-IN")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}