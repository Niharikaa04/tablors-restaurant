/**
 * Financial Pots — types only.
 *
 * Pot set follows the default list from the Tablors Pots/Loyalty developer
 * specification: GST, Staff Salary, Inventory, Maintenance, Subscriptions,
 * Service Charges, and Owner Profit.
 *
 * IMPORTANT: allocation basis (percentage of sales, fixed monthly target,
 * or manual owner entry) has not been confirmed yet. These types describe
 * a flat allocated/used snapshot only — there is deliberately no field for
 * "rule" or "method" until that decision is made, so we don't bake an
 * unconfirmed business rule into the schema.
 *
 * NOTE on "profit": the spec defines Owner Profit as "the remaining amount
 * after allocations," not a pot with its own spending target — it isn't
 * structurally identical to the other six. Until the allocation engine
 * exists, this mock module still gives it the same allocated/used/remaining
 * shape so the UI can render it consistently, interpreted as:
 *   allocated = target profit for the period (demo figure)
 *   used      = amount already withdrawn by the owner (demo figure)
 *   remaining = available to withdraw (derived)
 * This interpretation is an assumption for demo purposes only, not a
 * confirmed business rule.
 */

export type PotId =
  | "gst"
  | "salary"
  | "inventory"
  | "maintenance"
  | "subscriptions"
  | "service-charges"
  | "owner-profit";

export interface FinancialPot {
  id: PotId;
  name: string;
  description: string;
  /** Demo/mock figure only — not derived from real bills or payments. */
  allocatedRupees: number;
  /** Demo/mock figure only — not derived from real bills or payments. */
  usedRupees: number;
}