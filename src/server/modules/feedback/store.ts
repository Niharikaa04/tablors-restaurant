/**
 * DEMO DATA STORE — Customer Feedback (Feature: Customer Feedback, Step 1).
 *
 * Same in-memory pattern as demo-store/store.ts: resets on server
 * restart, holds no real customer data. Feedback is always tied to a
 * real orderId — never a table alone — so it can never be associated
 * with the wrong dining session.
 */

export type Feedback = {
  id: string;
  orderId: string;
  tableId: string;
  foodRating: number;
  serviceRating: number;
  orderingRating: number;
  comment: string | null;
  submittedAt: number;
};

const feedbackEntries: Feedback[] = [];
let feedbackCounter = 0;

export function listFeedback(): Feedback[] {
  return feedbackEntries.map((f) => ({ ...f }));
}

export function getFeedbackByOrderId(orderId: string): Feedback | null {
  return feedbackEntries.find((f) => f.orderId === orderId) ?? null;
}

export function submitFeedback(input: {
  orderId: string;
  tableId: string;
  foodRating: number;
  serviceRating: number;
  orderingRating: number;
  comment: string | null;
}): Feedback {
  feedbackCounter += 1;
  const entry: Feedback = {
    id: `f${feedbackCounter}`,
    orderId: input.orderId,
    tableId: input.tableId,
    foodRating: input.foodRating,
    serviceRating: input.serviceRating,
    orderingRating: input.orderingRating,
    comment: input.comment,
    submittedAt: Date.now(),
  };
  feedbackEntries.push(entry);
  return entry;
}