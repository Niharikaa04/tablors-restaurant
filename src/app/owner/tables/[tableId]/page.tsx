import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getTables,
  getOrders,
  type RestaurantTable,
  type Order,
} from "@/server/modules/demo-store/store";

import { removeTableAction } from "@/server/modules/tables/actions";

type PageProps = {
  params: Promise<{ tableId: string }>;
};

const statusStyles = {
  available: {
    border: "border-[var(--color-radium-700)]",
    text: "text-[var(--color-radium-500)]",
    bg: "bg-[var(--color-radium-500)]/5",
    symbol: "🟢",
  },

  occupied: {
    border: "border-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger)]/5",
    symbol: "🔴",
  },

  reserved: {
    border: "border-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/5",
    symbol: "🟡",
  },
} as const;

function getOrderTotal(order: Order | undefined): number {
  if (!order) {
    return 0;
  }

  return order.lines.reduce(
    (total, line) => total + line.qty * line.priceRupees,
    0
  );
}

export default async function TableDetailsPage({ params }: PageProps) {
  const { tableId } = await params;

  const tables = getTables();
  const orders = getOrders();

  const table = tables.find(
    (currentTable: RestaurantTable) => currentTable.id === tableId
  );

  if (!table) {
    notFound();
  }

  const order = table.currentOrderId
    ? orders.find(
        (currentOrder: Order) => currentOrder.id === table.currentOrderId
      )
    : undefined;

  const style = statusStyles[table.status];

  const itemCount =
    order?.lines.reduce((count, line) => count + line.qty, 0) ?? 0;

  const orderTotal = getOrderTotal(order);

  const hasActiveOrder = Boolean(order) || table.currentOrderId !== null;

  const statusLabel =
    table.status === "available"
      ? "Available"
      : table.status === "occupied"
        ? "Occupied"
        : "Reserved";

  return (
    <div className="space-y-8">
      {/* ================================================================
          HEADER
      ================================================================= */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/owner/tables"
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
          >
            <span aria-hidden="true">←</span>
            Back to tables
          </Link>

          <div className="mt-6 flex items-center gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">
              {style.symbol}
            </span>

            <h1 className="text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
              {table.label}
            </h1>
          </div>

          <p className={`mt-2 text-sm font-medium ${style.text}`}>
            {statusLabel}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:border-[var(--color-text-muted)]"
          >
            Rename
          </button>

          <button
            type="button"
            className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:border-[var(--color-text-muted)]"
          >
            {table.status === "reserved" ? "Mark available" : "Reserve table"}
          </button>
        </div>
      </div>

      {/* ================================================================
          STATUS + QUICK INFO
      ================================================================= */}

      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`rounded-[var(--radius-brand)] border ${style.border} ${style.bg} p-5`}
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Status
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span aria-hidden="true">{style.symbol}</span>

            <p className={`text-lg font-medium ${style.text}`}>
              {statusLabel}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Current items
          </p>

          <p className="mt-3 text-2xl font-medium text-[var(--color-text-primary)]">
            {itemCount}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Active customer items
          </p>
        </div>

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Current total
          </p>

          <p className="mt-3 text-2xl font-medium text-[var(--color-text-primary)]">
            ₹{orderTotal.toLocaleString("en-IN")}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Current order value
          </p>
        </div>
      </div>

      {/* ================================================================
          MAIN CONTENT
      ================================================================= */}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ---------------------------------------------------------------
            CURRENT ORDER
        ---------------------------------------------------------------- */}

        <section className="overflow-hidden rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-6">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                Customer order
              </p>

              <h2 className="mt-2 text-xl font-medium text-[var(--color-text-primary)]">
                {order ? `Order #${order.id}` : "No active order"}
              </h2>
            </div>

            {order && (
              <span className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs capitalize text-[var(--color-text-muted)]">
                {order.status}
              </span>
            )}
          </div>

          {order ? (
            <>
              <div className="divide-y divide-[var(--color-border)]">
                {order.lines.map((line) => {
                  const lineTotal = line.qty * line.priceRupees;

                  return (
                    <div
                      key={`${order.id}-${line.code}`}
                      className="flex items-center justify-between gap-4 p-5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)]">
                          {line.name}
                        </p>

                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          Code {line.code} · ₹
                          {line.priceRupees.toLocaleString("en-IN")} each
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm text-[var(--color-text-muted)]">
                          × {line.qty}
                        </p>

                        <p className="mt-1 font-medium text-[var(--color-text-primary)]">
                          ₹{lineTotal.toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[var(--color-border)] p-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Order total
                  </span>

                  <span className="text-xl font-medium text-[var(--color-text-primary)]">
                    ₹{orderTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                There is currently no active customer order for this table.
              </p>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------------
            TABLE MANAGEMENT
        ---------------------------------------------------------------- */}

        <section className="space-y-4">
          {/* Table controls */}

          <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Table management
            </p>

            <div className="mt-5 space-y-2">
              {order && (
                <Link
                  href={`/owner/orders#${order.id}`}
                  className="flex items-center justify-between rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-radium-700)] hover:text-[var(--color-radium-500)]"
                >
                  <span>View current order</span>

                  <span aria-hidden="true">→</span>
                </Link>
              )}

              <Link
                href={`/owner/billing?tableId=${table.id}`}
                className="flex items-center justify-between rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-radium-700)] hover:text-[var(--color-radium-500)]"
              >
                <span>View bill</span>

                <span aria-hidden="true">→</span>
              </Link>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-text-muted)]"
              >
                <span>Rename table</span>

                <span aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-text-muted)]"
              >
                <span>
                  {table.status === "reserved"
                    ? "Mark table available"
                    : "Reserve table"}
                </span>

                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          {/* Device */}

          <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Table device
                </p>

                <p className="mt-2 text-base font-medium text-[var(--color-text-primary)]">
                  Tablor device
                </p>
              </div>

              <span className="rounded-full border border-[var(--color-radium-700)] px-2.5 py-1 text-[11px] text-[var(--color-radium-500)]">
                Connected
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] p-3">
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Table
                </p>

                <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                  {table.label}
                </p>
              </div>

              <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] p-3">
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Status
                </p>

                <p className="mt-1 text-sm text-[var(--color-radium-500)]">
                  Online
                </p>
              </div>
            </div>
          </div>

          {/* Remove */}

          <div className="rounded-[var(--radius-brand)] border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-danger)]">
              Danger zone
            </p>

            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
              Removing a table is only allowed when it has no active customer
              order.
            </p>

            {hasActiveOrder ? (
              <button
                type="button"
                disabled
                className="mt-4 rounded-[var(--radius-brand)] border border-[var(--color-danger)] px-4 py-2.5 text-sm font-medium text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove table
              </button>
            ) : (
              <details className="mt-4">
                <summary className="inline-flex cursor-pointer list-none items-center rounded-[var(--radius-brand)] border border-[var(--color-danger)] px-4 py-2.5 text-sm font-medium text-[var(--color-danger)] transition hover:bg-[var(--color-danger)]/10 [&::-webkit-details-marker]:hidden">
                  Remove table
                </summary>

                <form
                  action={removeTableAction}
                  className="mt-3 space-y-3 rounded-[var(--radius-brand)] border border-[var(--color-danger)]/40 bg-[var(--color-bg)] p-4"
                >
                  <input type="hidden" name="tableId" value={table.id} />

                  <p className="text-sm leading-6 text-[var(--color-text-primary)]">
                    Remove {table.label}? This can&apos;t be undone.
                  </p>

                  <button
                    type="submit"
                    className="flex h-11 w-full items-center justify-center rounded-[var(--radius-brand)] bg-[var(--color-danger)] px-4 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Yes, remove table
                  </button>
                </form>
              </details>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}