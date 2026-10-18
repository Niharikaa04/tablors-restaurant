import "server-only";

import { randomUUID } from "node:crypto";

import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getDoc, listDocs, putDoc } from "@/server/modules/data/documents";

/**
 * Customer feedback, persisted in PostgreSQL (one document per order, keyed
 * by orderId, so an order can never receive feedback twice). Feedback is always tied to a
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

const COLLECTION = "feedback";

export async function listFeedback(): Promise<Feedback[]> {
  const docs = await listDocs<Feedback>(DEMO_RESTAURANT_ID, COLLECTION);
  return docs.map((d) => d.data);
}

export async function getFeedbackByOrderId(orderId: string): Promise<Feedback | null> {
  return getDoc<Feedback>(DEMO_RESTAURANT_ID, COLLECTION, orderId);
}

export async function submitFeedback(input: {
  orderId: string;
  tableId: string;
  foodRating: number;
  serviceRating: number;
  orderingRating: number;
  comment: string | null;
}): Promise<Feedback> {
  const entry: Feedback = {
    id: `f_${randomUUID()}`,
    orderId: input.orderId,
    tableId: input.tableId,
    foodRating: input.foodRating,
    serviceRating: input.serviceRating,
    orderingRating: input.orderingRating,
    comment: input.comment,
    submittedAt: Date.now(),
  };
  await putDoc(DEMO_RESTAURANT_ID, COLLECTION, input.orderId, entry);
  return entry;
}
