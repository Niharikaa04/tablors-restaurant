import Link from "next/link";
import { DayPicker } from "@/components/ui/day-picker";
import { istDay, resolveDay, todayIst, yesterdayIst } from "@/lib/day";

import { LiveRefresh } from "@/components/live/live-refresh";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import type { Order, RestaurantTable } from "@/server/modules/demo-store/store";
import {
  acknowledgeWaiter,
  advanceOrderFromForm,
} from "@/server/modules/orders/actions";
import { listAllOrders, listTables } from "@/server/modules/orders/db-orders";

// Orders change constantly — never prerender.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string; date?: string }>;
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
    // Dine-in: the owner only has two actions, Mark Ready and Mark Served.
    // Marking a new order ready passes through Preparing automatically.
    case "new":
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

function formatPlacedAt(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default async function LiveOrdersPage({ searchParams }: PageProps) {
  const { notice, date } = await searchParams;
  const noticeMessage = getNoticeMessage(
    typeof notice === "string" ? notice : undefined
  );

  let orders: Order[];
  let tables: RestaurantTable[];

  try {
    [orders, tables] = await Promise.all([
      listAllOrders(DEMO_RESTAURANT_ID),
      listTables(DEMO_RESTAURANT_ID),
    ]);
  } catch (err) {
    console.error("Live orders query failed", err);

    return (
      <div>
        <LiveRefresh />
        <h1 className="text-2xl text-[var(--color-text-primary)]">
          Live orders
        </h1>
        <div className="mt-4 rounded-[var(--radius-brand)] border border-[var(--color-warning)] bg-[var(--color-warning)]/10 px-4 py-3">
          <p className="text-sm text-[var(--color-warning)]">
            Couldn&apos;t load orders from the database. Check the connection
            and refresh the page.
          </p>
        </div>
      </div>
    );
  }

  const waiterCalls = tables.filter((t) => t.waiterCalled);

  const today = todayIst();
  const selectedDay = resolveDay(date);
  const isToday = selectedDay === today;

  // Cancelled orders never appear in the live flow.
  const dayOrders = orders
    .filter((o) => (o.status as string) !== "cancelled" && istDay(o.createdAt) === selectedDay)
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <div>
      <LiveRefresh />

      <h1 className="text-2xl text-[var(--color-text-primary)]">
        Live orders
      </h1>

      <DayPicker value={selectedDay} today={today} yesterday={yesterdayIst()} />

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
        {dayOrders.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {isToday ? "No orders yet today." : "No orders on this day."}
          </p>
        )}

        {dayOrders.map((order) => {
          const table = tables.find((t) => t.id === order.tableId);
          // Only today's orders can still be moved forward; past days are history.
          const action = isToday ? getNextActionLabel(order.status) : null;

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
                    Order #{order.id.slice(0, 8)} · Status: {getStatusLabel(order.status)}
                    {table?.waiterCalled && (
                      <span className="ml-2 text-[var(--color-gold-500)]">
                        · 🔔 Waiter called
                      </span>
                    )}
                  </p>

                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Placed {isToday ? formatElapsed(order.createdAt) : formatPlacedAt(order.createdAt)}
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
                  <li key={line.itemId ?? line.code}>
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