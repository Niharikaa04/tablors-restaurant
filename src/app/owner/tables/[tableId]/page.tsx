import Link from "next/link";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoRole } from "@/server/modules/auth/session";
import { formatAgo } from "@/server/modules/demo-store/device-telemetry";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getDevicesDb } from "@/server/modules/data/devices-db";
import { getTablesDb } from "@/server/modules/data/tables-db";
import { listActiveOrders } from "@/server/modules/orders/db-orders";
import {
  type Order,
  type RestaurantTable,
} from "@/server/modules/demo-store/store";
import { batteryTone } from "@/server/modules/demo-store/table-activity";
import { removeTableAction } from "@/server/modules/tables/actions";
import {
  releaseTableAction,
  renameTableAction,
  reserveTableAction,
} from "@/server/modules/tables/manage-actions";

type PageProps = {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
};

const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  renamed: { tone: "ok", text: "Table renamed." },
  "rename-invalid": {
    tone: "error",
    text: "Enter a table name (up to 40 characters).",
  },
  "rename-duplicate": {
    tone: "error",
    text: "Another table already uses that name.",
  },
  reserved: { tone: "ok", text: "Table reserved." },
  released: { tone: "ok", text: "Table is available again." },
  "cannot-reserve": {
    tone: "error",
    text: "Only an available table with no active order can be reserved.",
  },
  "cannot-release": {
    tone: "error",
    text: "This table still has an active order or an unpaid bill.",
  },
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

const BATTERY_TEXT = {
  ok: "text-[var(--color-text-primary)]",
  low: "text-[var(--color-warning)]",
  critical: "text-[var(--color-danger)]",
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

const HEADER_BUTTON =
  "rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:border-[var(--color-radium-700)] hover:text-[var(--color-radium-500)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-primary)]";
const ROW_BUTTON =
  "flex w-full items-center justify-between rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-primary)] transition hover:border-[var(--color-radium-700)] hover:text-[var(--color-radium-500)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-text-primary)]";

/** Opens the full reservation form (name, phone, party size, time) for this table. */
function ReserveLink({
  tableId,
  variant,
}: {
  tableId: string;
  variant: "header" | "row";
}) {
  return (
    <Link
      href={`/owner/tables?reserve=${tableId}#reservations`}
      className={variant === "header" ? HEADER_BUTTON : ROW_BUTTON}
    >
      <span>Reserve table</span>
      {variant === "row" && <span aria-hidden="true">→</span>}
    </Link>
  );
}

/** Mark available, as a real form so it works without client JS. */
function HoldForm({
  tableId,
  action,
  label,
  disabledReason,
  variant,
}: {
  tableId: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  disabledReason: string | null;
  variant: "header" | "row";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="tableId" value={tableId} />

      <button
        type="submit"
        disabled={disabledReason !== null}
        title={disabledReason ?? undefined}
        className={variant === "header" ? HEADER_BUTTON : ROW_BUTTON}
      >
        <span>{label}</span>

        {variant === "row" && <span aria-hidden="true">→</span>}
      </button>
    </form>
  );
}

export default async function TableDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const { tableId } = await params;
  const { notice: rawNotice } = await searchParams;

  const noticeCode = Array.isArray(rawNotice) ? rawNotice[0] : rawNotice;
  const notice = noticeCode ? NOTICES[noticeCode] : undefined;

  const canSeeDevices = hasPermission(await getDemoRole(), "devices");

  const tables = await getTablesDb(DEMO_RESTAURANT_ID);
  const orders = await listActiveOrders(DEMO_RESTAURANT_ID);

  const table = tables.find(
    (currentTable: RestaurantTable) => currentTable.id === tableId
  );

  if (!table) {
    notFound();
  }

  const device = (await getDevicesDb(DEMO_RESTAURANT_ID)).find((d) => d.tableId === table.id) ?? null;
  const hasBattery = device !== null && Number.isFinite(device.batteryPercent);

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

  // An available table with no order is reserved through the full form
  // (guest name, phone, party size, time). Anything else uses "Mark available".
  const useReserveForm = table.status === "available" && !hasActiveOrder;

  const hold = {
    action: releaseTableAction,
    label: "Mark available",
    disabledReason: hasActiveOrder
      ? "In use: this table has an active order"
      : null,
  };

  // Only used when the table is available but has an order (can't be reserved).
  const blockedReserve = {
    action: reserveTableAction,
    label: "Reserve table",
    disabledReason: "This table has an active order",
  };

  const headerHold = table.status === "available" ? blockedReserve : hold;

  return (
    <div className="space-y-8">
      <AutoRefresh intervalMs={3000} />

      {notice && (
        <div
          role="status"
          className={`rounded-[var(--radius-brand)] border px-4 py-3 text-sm ${
            notice.tone === "ok"
              ? "border-[var(--color-radium-700)] bg-[var(--color-radium-500)]/5 text-[var(--color-radium-500)]"
              : "border-[var(--color-danger)] bg-[var(--color-danger)]/5 text-[var(--color-danger)]"
          }`}
        >
          {notice.text}
        </div>
      )}

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
            Back to Tables &amp; Devices
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
          <a href="#rename-table" className={HEADER_BUTTON}>
            Rename
          </a>

          {useReserveForm ? (
            <ReserveLink tableId={table.id} variant="header" />
          ) : (
            <HoldForm
              tableId={table.id}
              action={headerHold.action}
              label={headerHold.label}
              disabledReason={headerHold.disabledReason}
              variant="header"
            />
          )}
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

              {useReserveForm ? (
                <ReserveLink tableId={table.id} variant="row" />
              ) : (
                <HoldForm
                  tableId={table.id}
                  action={headerHold.action}
                  label={headerHold.label}
                  disabledReason={headerHold.disabledReason}
                  variant="row"
                />
              )}

              {!useReserveForm && headerHold.disabledReason && (
                <p className="px-1 text-xs text-[var(--color-text-muted)]">
                  {headerHold.disabledReason}.
                </p>
              )}
            </div>

            {/* Rename */}

            <form
              action={renameTableAction}
              className="mt-5 space-y-3 border-t border-[var(--color-border)] pt-5"
            >
              <input type="hidden" name="tableId" value={table.id} />

              <label
                htmlFor="rename-table"
                className="block text-xs font-medium text-[var(--color-text-secondary)]"
              >
                Rename table
              </label>

              <input
                id="rename-table"
                name="label"
                type="text"
                required
                maxLength={40}
                defaultValue={table.label}
                className="h-11 w-full rounded-[var(--radius-brand)] border border-zinc-700 bg-black px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#d7fe3b]"
              />

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-brand)] px-4 text-sm font-medium text-black transition hover:brightness-110"
                style={{ backgroundColor: "var(--color-radium-500,#d7fe3b)" }}
              >
                Save name
              </button>
            </form>
          </div>

          {/* Device (real record; only for roles with the devices permission) */}

          {canSeeDevices && (
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

                {device && (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      device.online
                        ? "border-[var(--color-radium-700)] text-[var(--color-radium-500)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                    }`}
                  >
                    {device.online ? "Online" : "Offline"}
                  </span>
                )}
              </div>

              {device ? (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] p-3">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Battery
                    </p>

                    <p
                      className={`mt-1 text-sm ${
                        hasBattery
                          ? BATTERY_TEXT[batteryTone(device.batteryPercent)]
                          : "text-[var(--color-text-muted)]"
                      }`}
                    >
                      {hasBattery ? `${device.batteryPercent}%` : "—"}
                    </p>
                  </div>

                  <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] p-3">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Last seen
                    </p>

                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                      {formatAgo(device.lastSeenMinutesAgo)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--color-text-muted)]">
                  No device linked to this table.
                </p>
              )}
            </div>
          )}

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
                  className="mt-3 space-y-3 rounded-[var(--radius-brand)] border border-[var(--color-danger)]/40 bg-black p-4"
                >
                  <input type="hidden" name="tableId" value={table.id} />

                  <p className="text-sm leading-6 text-zinc-100">
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