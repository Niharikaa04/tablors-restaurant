import Link from "next/link";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { hasPermission } from "@/server/modules/auth/permissions";
import {
  DEMO_RESTAURANT_ID,
  getDemoRole,
  getDemoSession,
} from "@/server/modules/auth/session";
import { getDevicesDb } from "@/server/modules/data/devices-db";
import { listTodayReservationsDb } from "@/server/modules/data/reservations-db";
import { formatAgo } from "@/server/modules/demo-store/device-telemetry";
import { formatTimeLabel } from "@/server/modules/demo-store/reservations";
import {
  RESTAURANT_TIME_ZONE,
  type Device,
  type RestaurantTable,
} from "@/server/modules/demo-store/store";
import {
  BATTERY_CRITICAL_BELOW,
  BATTERY_LOW_AT_OR_BELOW,
  batteryTone,
  getTableActivities,
  type BatteryTone,
  type TableActivity,
  type TableDisplayState,
} from "@/server/modules/demo-store/table-activity";
import { createTableAction } from "@/server/modules/tables/actions";
import {
  ReservationsManager,
  type ReservationRow,
} from "../reservations/reservations-manager";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: RESTAURANT_TIME_ZONE,
  dateStyle: "full",
});

/* ------------------------------------------------------------------ */
/* Filters (driven by the clickable tiles, via ?filter=...)            */
/* ------------------------------------------------------------------ */

type Filter =
  | "all"
  | "available"
  | "occupied"
  | "reserved"
  | "devices"
  | "online"
  | "offline"
  | "low";

const FILTERS: readonly Filter[] = [
  "all",
  "available",
  "occupied",
  "reserved",
  "devices",
  "online",
  "offline",
  "low",
];
const DEVICE_FILTERS: readonly Filter[] = ["devices", "online", "offline", "low"];

const FILTER_LABEL: Record<Filter, string> = {
  all: "All tables",
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  devices: "With a device",
  online: "Device online",
  offline: "Device offline",
  low: "Low battery",
};

function matchesFilter(activity: TableActivity, filter: Filter): boolean {
  const { table, device } = activity;
  switch (filter) {
    case "all":
      return true;
    case "available":
    case "occupied":
    case "reserved":
      return table.status === filter;
    case "devices":
      return device !== null;
    case "online":
      return device !== null && device.online;
    case "offline":
      return device !== null && !device.online;
    case "low":
      return (
        device !== null &&
        Number.isFinite(device.batteryPercent) &&
        device.batteryPercent <= BATTERY_LOW_AT_OR_BELOW
      );
  }
}

/** Clicking the active tile again clears the filter. */
function filterHref(filter: Filter, active: Filter): string {
  return filter === "all" || filter === active
    ? "/owner/tables#table-grid"
    : `/owner/tables?filter=${filter}#table-grid`;
}

/* ------------------------------------------------------------------ */

const TONES = {
  green: {
    border: "border-[var(--color-radium-700)]",
    text: "text-[var(--color-radium-500)]",
    bg: "bg-[var(--color-radium-500)]/5",
  },
  amber: {
    border: "border-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/5",
  },
  red: {
    border: "border-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger)]/5",
  },
} as const;

/** Green is free, amber is held, red is in use. */
const STATE_TONE: Record<TableDisplayState, keyof typeof TONES> = {
  available: "green",
  paid: "green",
  reserved: "amber",
  seated: "red",
  "order-placed": "red",
  preparing: "red",
  ready: "red",
  eating: "red",
  "bill-issued": "red",
  "part-paid": "red",
};

const BATTERY_BAR: Record<BatteryTone, string> = {
  ok: "bg-[var(--color-success)]",
  low: "bg-[var(--color-warning,#e0a63a)]",
  critical: "bg-[var(--color-danger)]",
};
const BATTERY_TEXT: Record<BatteryTone, string> = {
  ok: "text-[var(--color-text-muted)]",
  low: "text-[var(--color-warning,#e0a63a)]",
  critical: "text-[var(--color-danger)]",
};
const BATTERY_LABEL: Record<BatteryTone, string> = {
  ok: "Normal",
  low: "Low",
  critical: "Critical",
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const DEFAULT_TILE =
  "border-[var(--color-border)] bg-[var(--color-surface)]";

/** Fixed fallbacks so these never render as black-on-black if a token is missing. */
const ACCENT = "var(--color-radium-500,#d7fe3b)";

/** A summary tile that filters the table grid when clicked. */
function Tile({
  label,
  value,
  hint,
  valueClass,
  toneClass,
  href,
  active,
}: {
  label: string;
  value: string | number;
  hint?: string;
  valueClass?: string;
  toneClass?: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll
      aria-current={active ? "true" : undefined}
      aria-label={`${label}: ${value}. ${active ? "Showing now, click to show all tables" : "Click to filter the tables"}`}
      className={`block rounded-[var(--radius-brand)] border p-4 transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-radium-500)] ${
        toneClass ?? DEFAULT_TILE
      } ${active ? "ring-2 ring-[var(--color-radium-500)]" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-medium ${valueClass ?? "text-[var(--color-text-primary)]"}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
      )}
    </Link>
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

/**
 * Where clicking a table's order area should go. Returns null when the
 * signed-in role cannot open the destination, so there is no dead end.
 */
function getOrderLink(
  activity: TableActivity,
  canOpenOrders: boolean,
  canOpenPayments: boolean
): { href: string; hint: string } | null {
  const { state, bill, table } = activity;

  if ((state === "bill-issued" || state === "part-paid") && bill) {
    return canOpenPayments
      ? { href: `/owner/payments?bill=${bill.id}`, hint: "Open payment" }
      : null;
  }

  if (state === "paid" && bill) {
    return canOpenPayments
      ? { href: `/owner/payments?bill=${bill.id}`, hint: "View payment" }
      : null;
  }

  if (activity.items.length > 0 && canOpenOrders) {
    return {
      href: table.currentOrderId
        ? `/owner/orders#${table.currentOrderId}`
        : "/owner/orders",
      hint: "Open in Live orders",
    };
  }

  return null;
}

/** Status, battery and last seen. Only rendered when a device is linked. */
function DeviceSection({ device }: { device: Device }) {
  const hasBattery = Number.isFinite(device.batteryPercent);
  const percent = hasBattery
    ? Math.min(100, Math.max(0, device.batteryPercent))
    : 0;
  const tone = batteryTone(percent);

  return (
    <div className="text-xs">
      <div className="flex items-center justify-between">
        <span
          className={`flex items-center gap-2 ${
            device.online
              ? "text-[var(--color-success)]"
              : "text-[var(--color-danger)]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              device.online
                ? "bg-[var(--color-success)]"
                : "bg-[var(--color-text-muted)]"
            }`}
          />
          {device.online ? "Online" : "Offline"}
        </span>

        {hasBattery && (
          <span className={BATTERY_TEXT[tone]}>
            {percent}% · {BATTERY_LABEL[tone]}
          </span>
        )}
      </div>

      {hasBattery && (
        <div
          role="progressbar"
          aria-label="Battery level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]"
        >
          <div
            className={`h-full rounded-full ${BATTERY_BAR[tone]} ${
              device.online ? "" : "opacity-50"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <p className="mt-2 text-[var(--color-text-muted)]">
        Last seen {formatAgo(device.lastSeenMinutesAgo)}
      </p>
    </div>
  );
}

function TableCard({
  activity,
  showDevice,
  orderLink,
  bookings,
  canReserve,
}: {
  activity: TableActivity;
  showDevice: boolean;
  orderLink: { href: string; hint: string } | null;
  bookings: ReservationRow[];
  canReserve: boolean;
}) {
  const { table, state, label, items, itemCount, totalRupees, bill } = activity;
  const tone = TONES[STATE_TONE[state]];

  const orderBody =
    state === "paid" && bill ? (
      <>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          Payment received
        </p>
        <p className="mt-1 text-2xl font-medium text-[var(--color-radium-500)]">
          Paid {rupees(bill.totalRupees)}
        </p>
        {bill.paymentMethod && (
          <p className="mt-1 text-xs capitalize text-[var(--color-text-muted)]">
            via {bill.paymentMethod}
          </p>
        )}
      </>
    ) : items.length > 0 ? (
      <>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {state === "eating" ? "Eating" : "Order"}
        </p>

        <div className="mt-3 space-y-2">
          {items.slice(0, 4).map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="min-w-0 truncate text-[var(--color-text-muted)]">
                {item.name}
              </span>
              <span className="shrink-0 text-[var(--color-text-primary)]">
                × {item.qty}
              </span>
            </div>
          ))}

          {items.length > 4 && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              +{items.length - 4} more item{items.length - 4 === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {itemCount} item{itemCount === 1 ? "" : "s"}
            {state === "part-paid" &&
              ` · paid ${rupees(activity.paidRupees)}, due ${rupees(activity.dueRupees)}`}
          </span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {rupees(totalRupees)}
          </span>
        </div>
      </>
    ) : (
      <p className="py-2 text-sm text-[var(--color-text-secondary)]">
        {state === "reserved"
          ? "Reserved, no active order"
          : state === "seated"
            ? "Seated, no order yet"
            : "No active customer order"}
      </p>
    );

  return (
    <div
      id={table.id}
      className={`overflow-hidden rounded-[var(--radius-brand)] border ${tone.border} ${tone.bg} transition-colors duration-200 hover:border-[var(--color-text-muted)]`}
    >
      {/* Header: opens the table's details */}
      <Link
        href={`/owner/tables/${table.id}`}
        aria-label={`Manage ${table.label}, ${label}`}
        className="flex items-start justify-between gap-3 p-5 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-radium-500)]"
      >
        <div>
          <p className="text-lg font-medium text-[var(--color-text-primary)]">
            {table.label}
          </p>
          <p className={`mt-1.5 text-sm font-medium ${tone.text}`}>{label}</p>
        </div>

        {table.waiterCalled && (
          <span className="rounded-full border border-[var(--color-warning)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-warning)]">
            🔔 Waiter called
          </span>
        )}
      </Link>

      {/* Order: opens Live orders (or the payment once billed) */}
      {orderLink ? (
        <Link
          href={orderLink.href}
          aria-label={`${orderLink.hint} for ${table.label}`}
          className="block border-t border-[var(--color-border)] px-5 py-4 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-radium-500)]"
        >
          {orderBody}
        </Link>
      ) : (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {orderBody}
        </div>
      )}

      {/* Booked guests for this table + a shortcut to reserve it */}
      {(bookings.length > 0 || (canReserve && state === "available")) && (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          {bookings.map((b) => (
            <p key={b.id} className="text-xs text-[var(--color-text-primary)]">
              {b.timeLabel} · {b.guestName} · party of {b.partySize}
            </p>
          ))}
          {canReserve && state === "available" && (
            <Link
              href={`/owner/tables?reserve=${table.id}#reservations`}
              className={`inline-block text-xs font-medium text-[var(--color-radium-500)] ${
                bookings.length > 0 ? "mt-2" : ""
              }`}
            >
              Reserve this table →
            </Link>
          )}
        </div>
      )}

      {/* Device (only when one is linked and the role may see devices) */}
      {showDevice && activity.device && (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <DeviceSection device={activity.device} />
        </div>
      )}
    </div>
  );
}

export default async function TablesAndDevicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    reserve?: string | string[];
    filter?: string | string[];
  }>;
}) {
  const { reserve, filter: rawFilter } = await searchParams;
  const reserveTableId = Array.isArray(reserve) ? reserve[0] : reserve;
  const filterValue = Array.isArray(rawFilter) ? rawFilter[0] : rawFilter;

  const session = await getDemoSession();
  const role = await getDemoRole();
  const canSeeDevices = hasPermission(role, "devices");
  const canOpenOrders = hasPermission(role, "orders");
  const canOpenPayments = hasPermission(role, "payments");
  const canReserve = session !== null && hasPermission(role, "reservations");

  // Unknown values, and device filters for roles without devices, fall back to "all".
  let activeFilter: Filter = FILTERS.includes(filterValue as Filter)
    ? (filterValue as Filter)
    : "all";
  if (!canSeeDevices && DEVICE_FILTERS.includes(activeFilter)) {
    activeFilter = "all";
  }

  const activities = await getTableActivities(DEMO_RESTAURANT_ID);
  const devices = await getDevicesDb(DEMO_RESTAURANT_ID);
  const tables = activities.map((a) => a.table);
  const visibleActivities = activities.filter((a) =>
    matchesFilter(a, activeFilter),
  );

  const todaysReservations =
    canReserve && session
      ? await listTodayReservationsDb(session.restaurantId)
      : [];
  const reservationRows: ReservationRow[] =
    canReserve && session
      ? todaysReservations.map((r) => {
          const table = tables.find((t) => t.id === r.tableId);
          return {
            id: r.id,
            tableId: r.tableId,
            timeLabel: formatTimeLabel(r.reservedFor),
            tableLabel: table?.label ?? r.tableId,
            guestName: r.guestName,
            phone: r.phone,
            partySize: r.partySize,
            status: r.status,
            tableStatus: table?.status ?? null,
            tableBusy: table ? table.currentOrderId !== null : false,
          };
        })
      : [];

  const availableCount = tables.filter((t) => t.status === "available").length;
  const occupiedCount = tables.filter((t) => t.status === "occupied").length;
  const reservedCount = tables.filter((t) => t.status === "reserved").length;

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.online).length;
  const offlineDevices = totalDevices - onlineDevices;
  const lowBattery = devices.filter(
    (d) =>
      Number.isFinite(d.batteryPercent) &&
      d.batteryPercent <= BATTERY_LOW_AT_OR_BELOW
  ).length;
  const criticalBattery = devices.filter(
    (d) =>
      Number.isFinite(d.batteryPercent) &&
      d.batteryPercent < BATTERY_CRITICAL_BELOW
  ).length;

  const nextTableLabel = getNextTableLabel(tables);

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={3000} />

      {/* Header */}
      <div className="flex items-start justify-between gap-5">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-[var(--color-text-primary)]">
            Tables &amp; Devices
          </h1>

          <p className="mt-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span
              aria-hidden="true"
              className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-radium-500)]"
            />
            Live
          </p>
        </div>

        {/* Add table: fixed colours, so hover and the open panel never go black */}
        <details className="relative">
          <summary
            className="flex h-11 w-fit cursor-pointer list-none items-center justify-center rounded-[var(--radius-brand,0.75rem)] px-5 text-sm font-medium text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
            style={{ backgroundColor: ACCENT, outlineColor: ACCENT }}
          >
            <span className="mr-2 text-lg leading-none" aria-hidden="true">
              +
            </span>
            Add table
          </summary>

          <div className="absolute right-0 z-20 mt-3 w-[min(320px,calc(100vw-2rem))] rounded-[var(--radius-brand,0.75rem)] border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
            <p className="text-sm font-medium text-zinc-100">
              Add restaurant table
            </p>

            <form action={createTableAction} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="table-label"
                  className="block text-xs font-medium text-zinc-300"
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
                  className="mt-2 h-11 w-full rounded-[var(--radius-brand,0.75rem)] border border-zinc-700 bg-black px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#d7fe3b]"
                />
              </div>

              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-[var(--radius-brand,0.75rem)] px-4 text-sm font-medium text-black transition hover:brightness-110"
                style={{ backgroundColor: ACCENT }}
              >
                Create table
              </button>
            </form>
          </div>
        </details>
      </div>

      {/* Table summary: click a tile to filter the tables below */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile
          label="Total tables"
          value={tables.length}
          href={filterHref("all", activeFilter)}
          active={activeFilter === "all"}
        />
        <Tile
          label="Available"
          value={availableCount}
          valueClass="text-[var(--color-radium-500)]"
          toneClass="border-[var(--color-radium-700)] bg-[var(--color-radium-500)]/5"
          href={filterHref("available", activeFilter)}
          active={activeFilter === "available"}
        />
        <Tile
          label="Occupied"
          value={occupiedCount}
          valueClass="text-[var(--color-danger)]"
          toneClass="border-[var(--color-danger)]/70 bg-[var(--color-danger)]/5"
          href={filterHref("occupied", activeFilter)}
          active={activeFilter === "occupied"}
        />
        <Tile
          label="Reserved"
          value={reservedCount}
          valueClass="text-[var(--color-warning)]"
          toneClass="border-[var(--color-warning)]/70 bg-[var(--color-warning)]/5"
          href={filterHref("reserved", activeFilter)}
          active={activeFilter === "reserved"}
        />
      </div>

      {/* Device summary (only for roles allowed to see devices) */}
      {canSeeDevices && (
        <div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile
              label="Total devices"
              value={totalDevices}
              href={filterHref("devices", activeFilter)}
              active={activeFilter === "devices"}
            />
            <Tile
              label="Online"
              value={onlineDevices}
              valueClass="text-[var(--color-success)]"
              href={filterHref("online", activeFilter)}
              active={activeFilter === "online"}
            />
            <Tile
              label="Offline"
              value={offlineDevices}
              valueClass={
                offlineDevices > 0 ? "text-[var(--color-danger)]" : undefined
              }
              href={filterHref("offline", activeFilter)}
              active={activeFilter === "offline"}
            />
            <Tile
              label="Low battery"
              value={lowBattery}
              hint={
                criticalBattery > 0
                  ? `${criticalBattery} critical`
                  : undefined
              }
              valueClass={
                lowBattery > 0 ? "text-[var(--color-warning,#e0a63a)]" : undefined
              }
              href={filterHref("low", activeFilter)}
              active={activeFilter === "low"}
            />
          </div>

          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Demo values until real devices report in.
          </p>
        </div>
      )}

      {/* Table grid */}
      <div id="table-grid" style={{ scrollMarginTop: "1.5rem" }}>
        {activeFilter !== "all" && (
          <p className="mb-4 text-sm text-[var(--color-text-muted)]">
            {FILTER_LABEL[activeFilter]}: showing {visibleActivities.length} of{" "}
            {tables.length} tables ·{" "}
            <Link
              href="/owner/tables#table-grid"
              className="font-medium text-[var(--color-radium-500)]"
            >
              Show all
            </Link>
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visibleActivities.map((activity) => (
            <TableCard
              key={activity.table.id}
              activity={activity}
              showDevice={canSeeDevices}
              orderLink={getOrderLink(activity, canOpenOrders, canOpenPayments)}
              bookings={reservationRows.filter(
                (r) => r.status === "booked" && r.tableId === activity.table.id,
              )}
              canReserve={canReserve}
            />
          ))}
        </div>

        {tables.length === 0 ? (
          <div className="rounded-[var(--radius-brand)] border border-dashed border-[var(--color-border)] p-12 text-center">
            <p className="text-base text-[var(--color-text-primary)]">
              No tables configured
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Add your first restaurant table to start managing the floor.
            </p>
          </div>
        ) : (
          visibleActivities.length === 0 && (
            <div className="rounded-[var(--radius-brand)] border border-dashed border-[var(--color-border)] p-10 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                No tables match this filter.
              </p>
            </div>
          )
        )}
      </div>

      {/* Reservations (merged in from the old Reservations tab) */}
      {canReserve && (
        <section id="reservations" style={{ scrollMarginTop: "1.5rem" }}>
          <ReservationsManager
            key={reserveTableId ?? "none"}
            embedded
            rows={reservationRows}
            tableOptions={tables.map((t) => ({ id: t.id, label: t.label }))}
            dateLabel={dateFormat.format(new Date())}
            autoOpenTableId={reserveTableId}
          />
        </section>
      )}
    </div>
  );
}