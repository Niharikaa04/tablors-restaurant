"use server";

import { revalidatePath } from "next/cache";
import { getBillByOrderId, getOrder } from "@/server/modules/demo-store/store";
import { getFeedbackByOrderId, submitFeedback } from "@/server/modules/feedback/store";

export type SubmitFeedbackInput = {
  orderId: string;
  tableId: string;
  foodRating: number;
  serviceRating: number;
  orderingRating: number;
  comment: string;
};

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: string };

function isValidRating(n: number) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

/**
 * Feedback is only ever accepted for an order that:
 *  1) actually exists and belongs to the claimed table, and
 *  2) has a Bill that is genuinely paid (paymentMethod + paidAt set),
 *  3) does not already have feedback recorded.
 *
 * This re-checks all three server-side — never trusts the client — so
 * feedback can't be attached to an unpaid order, a mismatched table,
 * or submitted twice for the same order.
 */
export async function submitCustomerFeedback(
  input: SubmitFeedbackInput
): Promise<SubmitFeedbackResult> {
  const order = getOrder(input.orderId);
  if (!order || order.tableId !== input.tableId) {
    return { ok: false, error: "Order not found for this table." };
  }

  const bill = getBillByOrderId(input.orderId);
  if (!bill || !bill.paymentMethod || !bill.paidAt) {
    return { ok: false, error: "This order isn't marked as paid yet." };
  }

  if (getFeedbackByOrderId(input.orderId)) {
    return { ok: false, error: "Feedback has already been submitted for this order." };
  }

  if (
    !isValidRating(input.foodRating) ||
    !isValidRating(input.serviceRating) ||
    !isValidRating(input.orderingRating)
  ) {
    return { ok: false, error: "Please rate all three categories (1-5 stars)." };
  }

  submitFeedback({
    orderId: input.orderId,
    tableId: input.tableId,
    foodRating: input.foodRating,
    serviceRating: input.serviceRating,
    orderingRating: input.orderingRating,
    comment: input.comment.trim() ? input.comment.trim() : null,
  });

  revalidatePath(`/customer/${input.tableId}`);

  return { ok: true };
}