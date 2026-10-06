import { RESTAURANT_TIME_ZONE, getTableById } from "@/server/modules/demo-store/store";

/**
 * DEMO reservations (in-memory), same approach as the rest of the demo store.
 * Every function takes restaurantId first and filters by it; restaurantId must
 * always come from the server session, never the browser.
 *
 * A reservation has its OWN status (booked / checked_in / cancelled). It never
 * stores or copies the table's status: tables keep their own status in
 * store.ts and the two are changed separately.
 */

export type ReservationStatus = "booked" | "checked_in" | "cancelled";

export interface Reservation {
  id: string;
  restaurantId: string;
  tableId: string;
  guestName: string;
  phone: string;
  partySize: number;
  reservedFor: number; // epoch ms, like the rest of the store
  status: ReservationStatus;
  createdAt: number;
  updatedAt: number;
}

/** A table cannot take two active reservations closer together than this. */
export const SLOT_MINUTES = 90;

// India has no daylight saving, so a fixed offset is exact for Asia/Kolkata.
const IST_OFFSET = "+05:30";

export function dayKey(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: RESTAURANT_TIME_ZONE });
}

/** "HH:mm" today (restaurant time zone) -> epoch ms. */
export function reservedForToday(time: string, now: number = Date.now()): number {
  return Date.parse(`${dayKey(now)}T${time}:00${IST_OFFSET}`);
}

export function formatTimeLabel(ms: number): string {
  return new Date(ms)
    .toLocaleTimeString("en-IN", {
      timeZone: RESTAURANT_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/[\u202f\u00a0]/g, " ")
    .toUpperCase();
}

function seed(): Reservation[] {
  // Starts empty: reservations are created by the owner.
  return [];
}

// globalThis keeps the data across Next.js hot reloads in dev.
const globalStore = globalThis as unknown as { __tablorsReservations?: Reservation[] };
function db(): Reservation[] {
  return (globalStore.__tablorsReservations ??= seed());
}

export function listTodayReservations(restaurantId: string, now: number = Date.now()): Reservation[] {
  const today = dayKey(now);
  return db()
    .filter((r) => r.restaurantId === restaurantId && dayKey(r.reservedFor) === today)
    .sort((a, b) => a.reservedFor - b.reservedFor)
    .map((r) => ({ ...r }));
}

export function getReservation(restaurantId: string, id: string): Reservation | undefined {
  const found = db().find((r) => r.restaurantId === restaurantId && r.id === id);
  return found ? { ...found } : undefined;
}

export type CreateReservationInput = {
  tableId: string;
  guestName: string;
  phone: string;
  partySize: number;
  reservedFor: number;
};

export type CreateReservationResult =
  | { ok: true; reservation: Reservation }
  | { ok: false; reason: "table-not-found" | "overlap" };

export function createReservation(
  restaurantId: string,
  input: CreateReservationInput
): CreateReservationResult {
  if (!getTableById(input.tableId)) return { ok: false, reason: "table-not-found" };

  const clash = db().some(
    (r) =>
      r.restaurantId === restaurantId &&
      r.tableId === input.tableId &&
      (r.status === "booked" || r.status === "checked_in") &&
      Math.abs(r.reservedFor - input.reservedFor) < SLOT_MINUTES * 60_000
  );
  if (clash) return { ok: false, reason: "overlap" };

  const now = Date.now();
  const reservation: Reservation = {
    id: `res_${crypto.randomUUID()}`,
    restaurantId,
    ...input,
    status: "booked",
    createdAt: now,
    updatedAt: now,
  };
  db().push(reservation);
  return { ok: true, reservation: { ...reservation } };
}

export function setReservationStatus(
  restaurantId: string,
  id: string,
  status: ReservationStatus
): Reservation | undefined {
  const found = db().find((r) => r.restaurantId === restaurantId && r.id === id);
  if (!found) return undefined;
  found.status = status;
  found.updatedAt = Date.now();
  return { ...found };
}