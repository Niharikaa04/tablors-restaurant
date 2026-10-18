import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, isNull, lt } from "drizzle-orm";

import { db } from "@/server/db/client";
import { reservations, restaurantTables } from "@/server/db/schema";
import {
  SLOT_MINUTES,
  dayKey,
  type CreateReservationInput,
  type CreateReservationResult,
  type Reservation,
  type ReservationStatus,
} from "@/server/modules/demo-store/reservations";

type Row = typeof reservations.$inferSelect;

function toReservation(r: Row): Reservation {
  return {
    id: r.id,
    restaurantId: r.restaurantId,
    tableId: r.tableId,
    guestName: r.guestName,
    phone: r.phone,
    partySize: r.partySize,
    reservedFor: r.reservedFor.getTime(),
    status: r.status as ReservationStatus,
    createdAt: r.createdAt.getTime(),
    updatedAt: r.updatedAt.getTime(),
  };
}

// India has no daylight saving, so a fixed offset is exact for Asia/Kolkata.
function istDayBounds(now: number): { start: Date; end: Date } {
  const start = new Date(`${dayKey(now)}T00:00:00+05:30`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function listTodayReservationsDb(
  restaurantId: string,
  now: number = Date.now(),
): Promise<Reservation[]> {
  const { start, end } = istDayBounds(now);
  const rows = await db
    .select()
    .from(reservations)
    .where(
      and(
        eq(reservations.restaurantId, restaurantId),
        gte(reservations.reservedFor, start),
        lt(reservations.reservedFor, end),
      ),
    )
    .orderBy(asc(reservations.reservedFor));
  return rows.map(toReservation);
}

export async function getReservationDb(
  restaurantId: string,
  id: string,
): Promise<Reservation | undefined> {
  const [row] = await db
    .select()
    .from(reservations)
    .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.id, id)));
  return row ? toReservation(row) : undefined;
}

export async function createReservationDb(
  restaurantId: string,
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  return db.transaction(async (tx): Promise<CreateReservationResult> => {
    // Locking the table row serialises concurrent bookings for that table.
    const [table] = await tx
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.restaurantId, restaurantId),
          eq(restaurantTables.id, input.tableId),
          isNull(restaurantTables.archivedAt),
        ),
      )
      .for("update");
    if (!table) return { ok: false, reason: "table-not-found" };

    const slotMs = SLOT_MINUTES * 60_000;
    const [clash] = await tx
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.restaurantId, restaurantId),
          eq(reservations.tableId, input.tableId),
          inArray(reservations.status, ["booked", "checked_in"]),
          gt(reservations.reservedFor, new Date(input.reservedFor - slotMs)),
          lt(reservations.reservedFor, new Date(input.reservedFor + slotMs)),
        ),
      )
      .limit(1);
    if (clash) return { ok: false, reason: "overlap" };

    const [row] = await tx
      .insert(reservations)
      .values({
        id: `res_${randomUUID()}`,
        restaurantId,
        tableId: input.tableId,
        guestName: input.guestName,
        phone: input.phone,
        partySize: input.partySize,
        reservedFor: new Date(input.reservedFor),
        status: "booked",
      })
      .returning();
    return { ok: true, reservation: toReservation(row) };
  });
}

export async function setReservationStatusDb(
  restaurantId: string,
  id: string,
  status: ReservationStatus,
): Promise<Reservation | undefined> {
  const [row] = await db
    .update(reservations)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(reservations.restaurantId, restaurantId), eq(reservations.id, id)))
    .returning();
  return row ? toReservation(row) : undefined;
}
