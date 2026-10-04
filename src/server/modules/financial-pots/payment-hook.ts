import type { Bill } from "@/server/modules/demo-store/store";
import { getPayments } from "@/server/modules/demo-store/store";
import { DEMO_BUSINESS_ID, getPotsRuntime } from "@/server/modules/pots/runtime";
import type { BillBreakdown } from "./core/loyalty";
import { currentLoyaltyRule, getLoyaltyRuntime } from "./loyalty-runtime";

/**
 * Bridge from the existing billing/payment actions into the Pots ledger.
 *
 * PROTOTYPE: payments come from the in-memory demo store, not a payment provider.
 * Everything recorded here is sandbox data (PaymentRecord.simulated === true).
 *
 * Contract (unchanged for callers):
 *  - onBillPaymentConfirmed is called once a bill is fully settled.
 *  - It must never throw into the billing flow; the caller also wraps it in try/catch.
 *
 * Idempotency: each store payment id is used as the provider reference, so calling
 * this twice (or for a bill whose earlier payments were already handled) cannot
 * allocate any payment twice.
 */

/** Rupees (store) -> integer paise (ledger). Never use floats inside the ledger. */
export function rupeesToPaise(rupees: number): number {
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error(`invalid amount: ${rupees}`);
  return paise;
}

/**
 * ASSUMED store payment shape: { id, billId, amountRupees }. If your store uses other
 * field names, change ONLY this function; typecheck/the runtime check below will flag it.
 */
function readStorePayment(p: unknown): { id: string; billId: string; amountRupees: number } | null {
  const r = p as { id?: unknown; billId?: unknown; amountRupees?: unknown };
  if (typeof r.id === "string" && typeof r.billId === "string" && typeof r.amountRupees === "number") {
    return { id: r.id, billId: r.billId, amountRupees: r.amountRupees };
  }
  console.error("[pots] unexpected payment shape from demo store; skipping", p);
  return null;
}

/** Optional customer context. When the billing flow knows the loyalty member, pass it and points are credited automatically. */
export interface LoyaltyContext { customerId: string; bill: BillBreakdown }

export function onBillPaymentConfirmed(billId: string, method: NonNullable<Bill["paymentMethod"]>, loyalty?: LoyaltyContext): void {
  const rt = getPotsRuntime();
  const at = new Date();
  const paymentIds: string[] = [];
  for (const raw of getPayments()) {
    const p = readStorePayment(raw);
    if (!p || p.billId !== billId) continue;
    paymentIds.push(p.id);
    const result = rt.payments.handleEvent({
      providerEventId: `demo:${p.id}:success`,
      providerRef: p.id,
      businessId: DEMO_BUSINESS_ID,
      billId,
      amount: rupeesToPaise(p.amountRupees),
      status: "SUCCESS",
      at,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log(`[pots] bill ${billId} payment ${p.id} (${method}): ${result.outcome} (sandbox)`);
    }
  }
  if (loyalty && paymentIds.length > 0) awardLoyaltyPoints(billId, paymentIds, loyalty, at);
}

/**
 * Loyalty is driven by the SAME bill/payment ids as the Pots ledger but never touches it (Addendum §12).
 * Points are earned once per bill (idempotent) and only because the payment is SUCCESS here.
 * Never throws into the billing flow.
 */
function awardLoyaltyPoints(billId: string, paymentIds: string[], ctx: LoyaltyContext, at: Date): void {
  try {
    const lr = getLoyaltyRuntime();
    const rule = currentLoyaltyRule(lr, DEMO_BUSINESS_ID);
    if (!rule) return; // owner has not configured loyalty
    const res = lr.ledger.earn({ rule, customerId: ctx.customerId, billId, paymentId: paymentIds[0]!, paymentStatus: "SUCCESS", bill: ctx.bill, at });
    const link = { businessId: DEMO_BUSINESS_ID, customerId: ctx.customerId, billId, billPaise: ctx.bill.totalPaise, refundedPaise: 0 };
    for (const id of paymentIds) if (!lr.links.has(id)) lr.links.set(id, link);
    if (process.env.NODE_ENV !== "production") console.log(`[loyalty] bill ${billId}: ${res.status} ${res.points} pts (sandbox)`);
  } catch (error) {
    console.error("[loyalty] could not award points", billId, error);
  }
}

/** Refund -> reverse points per the merchant's refund policy (and restore redeemed points if so configured). */
function reverseLoyaltyForRefund(refundId: string, paymentId: string, amountPaise: number): void {
  try {
    const lr = getLoyaltyRuntime();
    const link = lr.links.get(paymentId);
    if (!link) return; // payment earned no points
    const rule = currentLoyaltyRule(lr, link.businessId);
    if (!rule) return;
    link.refundedPaise += amountPaise;
    lr.ledger.refundReversal({ businessId: link.businessId, customerId: link.customerId, billId: link.billId, refundId, refundedPaise: link.refundedPaise, billPaise: link.billPaise, policy: rule.refundPolicy });
  } catch (error) {
    console.error("[loyalty] refund reversal failed", refundId, error);
  }
}

/**
 * Called after the store accepted a refund. The store has already recorded it, so a
 * BLOCKED result (pots/unallocated cannot cover the reversal) is surfaced as an owner
 * alert + reconciliation exception by PaymentService, and logged here — never thrown.
 */
export function onPaymentRefunded(input: {
  refundId: string;
  paymentId: string;
  amountRupees: number;
  reason: string;
  /** Set only after the caller has verified PIN/OTP. Large refunds are not reversed in the ledger without it. */
  stepUpVerified?: boolean;
}): void {
  const rt = getPotsRuntime();
  try {
    const res = rt.payments.refund({
      refundId: input.refundId,
      providerRef: input.paymentId,
      amount: rupeesToPaise(input.amountRupees),
      actorId: "owner",
      at: new Date(),
      reason: input.reason,
      stepUpVerified: input.stepUpVerified,
    });
    if (res.status === "STEP_UP_REQUIRED") {
      console.error("[pots] large refund needs step-up before the ledger is reversed", input.refundId);
      return;
    }
    if (res.status === "BLOCKED") {
      console.error("[pots] refund recorded in store but blocked in pots ledger", input.refundId, res.shortfalls);
    }
    if (res.status === "APPLIED") reverseLoyaltyForRefund(input.refundId, input.paymentId, rupeesToPaise(input.amountRupees));
  } catch (error) {
    // e.g. payment was never allocated (settled before Pots existed, or still partial)
    console.error("[pots] refund not applied to pots ledger", input.refundId, error);
  }
}
