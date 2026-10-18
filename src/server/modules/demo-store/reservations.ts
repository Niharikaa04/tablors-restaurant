import { RESTAURANT_TIME_ZONE } from "@/server/modules/demo-store/store";

/**
 * Reservation types and pure time helpers. Persistence lives in
 * src/server/modules/data/reservations-db.ts (PostgreSQL).
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
