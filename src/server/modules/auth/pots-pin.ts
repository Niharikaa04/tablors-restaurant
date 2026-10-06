/**
 * Financial Pots PIN gate — DEMO ONLY.
 *
 * This project does not yet have a configured, per-owner Financial Pots
 * PIN, so this uses a single hardcoded demo PIN, matching how
 * demo-auth.ts handles demo credentials elsewhere in this project.
 *
 * This is NOT real security for real financial data. Before this touches
 * anything real, replace checkPotsPin() with a per-owner PIN stored
 * (hashed) in your database, and rate-limit attempts.
 *
 * The PIN value itself is only ever read and compared here, on the
 * server — it is never sent to the client.
 */

export const POTS_PIN_COOKIE = "tablors_pots_pin_verified";

/**
 * Demo PIN. Override locally by setting POTS_DEMO_PIN in .env.local if
 * you want to test with a different value without editing this file.
 */
const DEMO_POTS_PIN = process.env.POTS_DEMO_PIN ?? "2358";

export function checkPotsPin(pin: string): boolean {
  return pin.trim() === DEMO_POTS_PIN;
}