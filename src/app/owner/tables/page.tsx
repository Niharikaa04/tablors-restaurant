import Link from "next/link";

import {
  getTables,
  getOrders,
  type RestaurantTable,
  type Order,
} from "@/server/modules/demo-store/store";

import { createTableAction } from "@/server/modules/tables/actions";

const statusStyles = {
  available: {
    border: "border-[var(--color-radium-700)]",
    text: "text-[var(--color-radium-500)]",
    bg: "bg-[var(--color-radium-500)]/5",
  },

  occupied: {
    border: "border-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger)]/5",
  },

  reserved: {
    border: "border-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/5",
  },
} as const;

function getStatusSymbol(status: RestaurantTable["status"]): string {
  switch (status) {
    case "available":
      return "🟢";

    case "occupied":
      return "🔴";

    case "reserved":
      return "🟡";

    default:
      return "⚪";
  }
}

function getStatusLabel(status: RestaurantTable["status"]): string {
  switch (status) {
    case "available":
      return "Available";

    case "occupied":
      return "Occupied";

    case "reserved":
      return "Reserved";

    default:
      return "Unknown";
  }
}

function getOrderTotal(order: Order | undefined): number {
  if (!order) {
    return 0;
  }

  return order.lines.reduce(
    (total, line) => total + line.qty * line.priceRupees,
    0
  );
}
function getNextTableLabel(tables: RestaurantTable[]): string {
  const used = new Set(
    tables
      .map((table) => table.label.trim().match(/^table\s*(\d+)$/i))
      .filter((match) => match !== null)
      .map((match) => Number(match[1]))
  );

  let next = 1;

  while (used.has(next)) {
    next += 1;
  }

  return `Table ${String(next).padStart(2, "0")}`;
}

export default function TablesPage() {
  const tables = getTables();
  const orders = getOrders();

  const availableCount = tables.filter(
    (table) => table.status === "available"
  ).length;

  const occupiedCount = tables.filter(
    (table) => table.status === "occupied"
  ).length;

  const reservedCount = tables.filter(
    (table) => table.status === "reserved"
  ).length;

  const nextTableLabel = getNextTableLabel(tables);

  return (
    <div className="space-y-8">
      {/* ============================================================
          HEADER
      ============================================================ */}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--color-radium-500)]">
            Floor management
          </p>

          <h1 className="mt-2 text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Tables
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
            Manage your restaurant floor, table availability and active
            customer orders.
          </p>
        </div>

        {/* ==========================================================
            ADD TABLE
            The panel is in normal document flow, so opening the
            <details> pushes everything below it downward.
        ========================================================== */}

        <details className="w-full sm:w-auto">
          <summary className="flex h-11 w-fit cursor-pointer list-none items-center justify-center rounded-[var(--radius-brand)] border border-[var(--color-radium-500)] bg-[var(--color-radium-500)] px-5 text-sm font-medium text-black transition hover:bg-[var(--color-radium-400)] sm:ml-auto [&::-webkit-details-marker]:hidden">
            <span
              className="mr-2 text-lg leading-none"
              aria-hidden="true"
            >
              +
            </span>

            Add table
          </summary>

          <div className="mt-3 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:w-[320px]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Add restaurant table
              </p>

              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                Create a new table for your restaurant floor.
              </p>
            </div>

            <form action={createTableAction} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="table-label"
                  className="block text-xs font-medium text-[var(--color-text-secondary)]"
                >
                  Table name
                </label>

                <input
                  id="table-label"
                  name="label"
                  type="text"
                  required
                  maxLength={40}
                  defaultValue={nextTableLabel}
                  placeholder="Table 07"
                  className="mt-2 h-11 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-radium-500)]"
                />
              </div>

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-brand)] bg-[var(--color-radium-500)] px-4 text-sm font-medium text-black transition hover:bg-[var(--color-radium-400)]"
              >
                Create table
              </button>
            </form>
          </div>
        </details>
      </div>

      {/* ============================================================
          SUMMARY
      ============================================================ */}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total */}

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Total tables
          </p>

          <p className="mt-3 text-3xl font-medium text-[var(--color-text-primary)]">
            {tables.length}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Restaurant floor
          </p>
        </div>

        {/* Available */}

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-radium-700)] bg-[var(--color-radium-500)]/5 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🟢</span>

            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Available
            </p>
          </div>

          <p className="mt-3 text-3xl font-medium text-[var(--color-radium-500)]">
            {availableCount}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Ready for guests
          </p>
        </div>

        {/* Occupied */}

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-danger)]/70 bg-[var(--color-danger)]/5 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🔴</span>

            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Occupied
            </p>
          </div>

          <p className="mt-3 text-3xl font-medium text-[var(--color-danger)]">
            {occupiedCount}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Active dining
          </p>
        </div>

        {/* Reserved */}

        <div className="rounded-[var(--radius-brand)] border border-[var(--color-warning)]/70 bg-[var(--color-warning)]/5 p-5">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🟡</span>

            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Reserved
            </p>
          </div>

          <p className="mt-3 text-3xl font-medium text-[var(--color-warning)]">
            {reservedCount}
          </p>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Held for guests
          </p>
        </div>
      </div>

      {/* ============================================================
          FLOOR OVERVIEW
      ============================================================ */}

      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-[var(--color-text-primary)]">
            Floor overview
          </h2>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Green is available, red is occupied and yellow is reserved.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span aria-hidden="true">🟢</span>
            Available
          </span>

          <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span aria-hidden="true">🔴</span>
            Occupied
          </span>

          <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
            <span aria-hidden="true">🟡</span>
            Reserved
          </span>
        </div>
      </div>

      {/* ============================================================
          TABLE GRID
      ============================================================ */}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tables.map((table: RestaurantTable) => {
          const order: Order | undefined = table.currentOrderId
            ? orders.find(
                (currentOrder: Order) =>
                  currentOrder.id === table.currentOrderId
              )
            : undefined;

          const style = statusStyles[table.status];

          const itemCount =
            order?.lines.reduce((count, line) => count + line.qty, 0) ?? 0;

          const orderTotal = getOrderTotal(order);

          return (
            <Link
              key={table.id}
              id={table.id}
              href={`/owner/tables/${table.id}`}
              aria-label={`Manage ${table.label}`}
              className={`group block overflow-hidden rounded-[var(--radius-brand)] border ${style.border} ${style.bg} transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-text-muted)] hover:shadow-[0_12px_35px_rgba(0,0,0,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radium-500)]`}
            >
              {/* Table header */}

              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xl leading-none"
                      aria-hidden="true"
                    >
                      {getStatusSymbol(table.status)}
                    </span>

                    <p className="text-lg font-medium text-[var(--color-text-primary)]">
                      {table.label}
                    </p>
                  </div>

                  <p className={`mt-2 text-sm font-medium ${style.text}`}>
                    {getStatusLabel(table.status)}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] transition group-hover:border-[var(--color-radium-700)] group-hover:text-[var(--color-radium-500)]"
                >
                  →
                </span>
              </div>

              {/* Current order */}

              <div className="border-t border-[var(--color-border)] px-5 py-4">
                {order ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                          Current order
                        </p>

                        <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                          #{order.id}
                        </p>
                      </div>

                      <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] capitalize text-[var(--color-text-muted)]">
                        {order.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {order.lines.slice(0, 3).map((line) => (
                        <div
                          key={`${order.id}-${line.code}`}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="min-w-0 truncate text-[var(--color-text-muted)]">
                            {line.name}
                          </span>

                          <span className="shrink-0 text-[var(--color-text-primary)]">
                            × {line.qty}
                          </span>
                        </div>
                      ))}

                      {order.lines.length > 3 && (
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          +{order.lines.length - 3} more item
                          {order.lines.length - 3 === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </span>

                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        ₹{orderTotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                      Table activity
                    </p>

                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      {table.status === "reserved"
                        ? "Reserved — no active order"
                        : "No active customer order"}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}

              <div className="border-t border-[var(--color-border)] px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Manage table
                  </span>

                  <span className="text-xs font-medium text-[var(--color-radium-500)] opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty state */}

      {tables.length === 0 && (
        <div className="rounded-[var(--radius-brand)] border border-dashed border-[var(--color-border)] p-12 text-center">
          <p className="text-base text-[var(--color-text-primary)]">
            No tables configured
          </p>

          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Add your first restaurant table to start managing the floor.
          </p>
        </div>
      )}
    </div>
  );
}