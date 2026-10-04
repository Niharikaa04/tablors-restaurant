import { requirePermission } from "@/server/modules/auth/session";
import { formatTimeLabel, listTodayReservations } from "@/server/modules/demo-store/reservations";
import { RESTAURANT_TIME_ZONE, getTables } from "@/server/modules/demo-store/store";
import { ReservationsManager, type ReservationRow } from "./reservations-manager";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: RESTAURANT_TIME_ZONE,
  dateStyle: "full",
});

export default async function ReservationsPage() {
  // Unauthenticated -> /login. Cashier / Kitchen -> their own home.
  const session = await requirePermission("reservations");

  const tables = getTables();
  const rows: ReservationRow[] = listTodayReservations(session.restaurantId).map((r) => {
    const table = tables.find((t) => t.id === r.tableId);
    return {
      id: r.id,
      timeLabel: formatTimeLabel(r.reservedFor),
      tableLabel: table?.label ?? r.tableId,
      guestName: r.guestName,
      phone: r.phone,
      partySize: r.partySize,
      status: r.status,
      // The TABLE's own status, kept separate from the reservation status.
      tableStatus: table?.status ?? null,
      tableBusy: table ? table.currentOrderId !== null : false,
    };
  });

  return (
    <ReservationsManager
      rows={rows}
      tableOptions={tables.map((t) => ({ id: t.id, label: t.label }))}
      dateLabel={dateFormat.format(new Date())}
    />
  );
}