"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession, type DemoSession } from "@/server/modules/auth/session";
import {
  SLOT_MINUTES,
  createReservation,
  getReservation,
  reservedForToday,
  formatTimeLabel,
  setReservationStatus,
} from "@/server/modules/demo-store/reservations";
import { getTableById, setTableStatus } from "@/server/modules/demo-store/store";
import { notify } from "@/server/modules/notifications/store";

export type ReservationActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(1).max(100);
const tableStatusSchema = z.enum(["occupied", "available"]);
const reserveSchema = z.object({
  tableId: z.string().min(1).max(50),
  guestName: z.string().trim().min(2, "Guest name must be at least 2 characters").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number"),
  partySize: z.coerce.number().int("Party size must be a whole number").min(1).max(50),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time"),
});

function fail(error: string): ReservationActionResult {
  return { ok: false, error };
}

function refresh() {
  revalidatePath("/owner/reservations");
  revalidatePath("/owner/tables");
  revalidatePath("/owner");
}

type AuthResult = { ok: true; session: DemoSession } | { ok: false; error: string };

// Role and restaurantId come from the server session only, never from the request.
async function authorize(): Promise<AuthResult> {
  const session = await getDemoSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!hasPermission(session.role, "reservations")) {
    return { ok: false, error: "You do not have access to reservations." };
  }
  return { ok: true, session };
}

export async function reserveAction(input: unknown): Promise<ReservationActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsed = reserveSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;

  const table = getTableById(data.tableId);
  if (!table) return fail("Table not found.");

  const result = createReservation(session.restaurantId, {
    tableId: table.id,
    guestName: data.guestName,
    phone: data.phone,
    partySize: data.partySize,
    reservedFor: reservedForToday(data.time),
  });
  if (!result.ok) {
    return fail(
      result.reason === "overlap"
        ? `${table.label} already has a reservation within ${SLOT_MINUTES} minutes of that time.`
        : "Table not found."
    );
  }
    notify({
    type: "TABLE_RESERVED",
    title: "Table reserved",
    message: `Table ${result.reservation.tableId} reserved for ${formatTimeLabel(result.reservation.reservedFor)}.`,
    tableId: result.reservation.tableId,
    dedupeKey: `table-reserved:${result.reservation.id}`,
  });
 
  refresh();
  return { ok: true };
}

export async function cancelReservationAction(id: unknown): Promise<ReservationActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Invalid reservation.");

  const reservation = getReservation(session.restaurantId, parsedId.data);
  if (!reservation) return fail("Reservation not found.");
  if (reservation.status !== "booked") return fail("Only booked reservations can be cancelled.");

  setReservationStatus(session.restaurantId, reservation.id, "cancelled");
  refresh();
  return { ok: true };
}

export async function checkInReservationAction(id: unknown): Promise<ReservationActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Invalid reservation.");

  const reservation = getReservation(session.restaurantId, parsedId.data);
  if (!reservation) return fail("Reservation not found.");
  if (reservation.status !== "booked") return fail("Only booked reservations can be checked in.");

  const table = getTableById(reservation.tableId);
  if (!table) return fail("This table no longer exists.");
  if (table.currentOrderId !== null) {
    return fail(`${table.label} still has an active order. Finish it before checking in this guest.`);
  }

  const moved = setTableStatus(table.id, "occupied");
  if (!moved.ok) return fail("Could not update the table.");

  setReservationStatus(session.restaurantId, reservation.id, "checked_in");
  refresh();
  return { ok: true };
}

// The table is resolved from the reservation on the server; the browser never
// sends a table id for this action.
export async function markTableAction(
  reservationId: unknown,
  status: unknown
): Promise<ReservationActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsedId = idSchema.safeParse(reservationId);
  const parsedStatus = tableStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return fail("Invalid request.");

  const reservation = getReservation(session.restaurantId, parsedId.data);
  if (!reservation) return fail("Reservation not found.");
  if (reservation.status === "cancelled") return fail("This reservation is cancelled.");

  const result = setTableStatus(reservation.tableId, parsedStatus.data);
  if (!result.ok) {
    return fail(
      result.reason === "has-active-order"
        ? "This table has an active order or an unpaid bill, so it can't be marked available."
        : "Table not found."
    );
  }

  refresh();
  return { ok: true };
}