import { PotsService, type PaymentEvent } from "./pots-service";
import { LoyaltyLedger, type BillBreakdown, type LoyaltyRule } from "./loyalty";

/**
 * Single entry point for a provider payment event. Drives BOTH ledgers from the
 * same bill/payment id while keeping them independent: loyalty only sees a
 * status + bill breakdown, never a Pot; Pots never see points.
 */
export function processPaymentEvent(deps: {
  pots: PotsService; loyalty?: LoyaltyLedger; loyaltyRule?: LoyaltyRule;
}, ev: PaymentEvent, loyaltyCtx?: { customerId: string; bill: BillBreakdown }) {
  const money = deps.pots.handlePaymentEvent(ev);
  let points: ReturnType<LoyaltyLedger["earn"]> | undefined;
  if (deps.loyalty && deps.loyaltyRule && loyaltyCtx) {
    points = deps.loyalty.earn({
      rule: deps.loyaltyRule, customerId: loyaltyCtx.customerId, billId: ev.billId, paymentId: ev.paymentId,
      paymentStatus: ev.status, bill: loyaltyCtx.bill, at: ev.at,
    });
  }
  return { money, points };
}
