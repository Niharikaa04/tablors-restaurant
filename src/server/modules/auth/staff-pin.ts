/**
 * Staff page PIN gate. DEMO ONLY, same approach as the Financial pots PIN.
 * Replace with a per-owner hashed PIN in the database, plus attempt
 * rate-limiting, before real use.
 */

export const STAFF_PIN_COOKIE = "tablors_staff_pin_verified";

/** Demo PIN. Set STAFF_DEMO_PIN in .env.local to use your own. */
const DEMO_STAFF_PIN = process.env.STAFF_DEMO_PIN ?? "2358";

export function checkStaffPin(pin: string): boolean {
  return pin.trim() === DEMO_STAFF_PIN;
}