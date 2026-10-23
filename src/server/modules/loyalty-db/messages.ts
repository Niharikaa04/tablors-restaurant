import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/server/db/client";
import { loyaltyCustomers } from "@/server/db/schema";
import { listDocs, putDoc } from "@/server/modules/data/documents";

/** Hard ceiling per send, so one click can never use up the whole SMS limit. */
export const MAX_RECIPIENTS_PER_SEND = 100;
export const MAX_MESSAGE_LENGTH = 300;

const MESSAGES = "loyalty_messages";

type StoredMessage = { phone: string; text: string };

export type QueueResult =
  | { ok: true; queued: number; skippedBlocked: number; skippedDuplicate: number }
  | { ok: false; error: string };

/**
 * Queues an offer / discount message for the SELECTED members only.
 * The phone numbers are looked up here, on the server, from member ids: the
 * browser never receives a full number.
 *
 * No SMS/WhatsApp provider is connected, so messages are queued ("queued-demo"),
 * exactly like the older offers flow. Blocked members are skipped, and a member
 * who already got the identical text is skipped so a double click costs nothing.
 */
export async function queueMemberMessagesDb(
  restaurantId: string,
  memberIds: string[],
  rawText: string,
): Promise<QueueResult> {
  const text = rawText.trim();
  if (text.length < 5) return { ok: false, error: "Write a message of at least 5 characters." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Keep the message under ${MAX_MESSAGE_LENGTH} characters.` };
  }

  const ids = [...new Set(memberIds)].filter((id) => id.length > 0 && id.length < 100);
  if (ids.length === 0) return { ok: false, error: "Select at least one member." };
  if (ids.length > MAX_RECIPIENTS_PER_SEND) {
    return {
      ok: false,
      error: `You can message up to ${MAX_RECIPIENTS_PER_SEND} members at a time. Select fewer and send again.`,
    };
  }

  const rows = await db
    .select({ phone: loyaltyCustomers.phone, status: loyaltyCustomers.status })
    .from(loyaltyCustomers)
    .where(and(eq(loyaltyCustomers.restaurantId, restaurantId), inArray(loyaltyCustomers.id, ids)));

  const sent = new Set(
    (await listDocs<StoredMessage>(restaurantId, MESSAGES))
      .filter((d) => d.data.text === text)
      .map((d) => d.data.phone),
  );

  let queued = 0;
  let skippedBlocked = 0;
  let skippedDuplicate = 0;

  for (const row of rows) {
    if (row.status !== "active") {
      skippedBlocked += 1;
      continue;
    }
    if (sent.has(row.phone)) {
      skippedDuplicate += 1;
      continue;
    }
    const id = `msg_${randomUUID()}`;
    await putDoc(restaurantId, MESSAGES, id, {
      id,
      phone: row.phone,
      offerId: "custom",
      text,
      status: "queued-demo",
      createdAt: new Date().toISOString(),
    });
    queued += 1;
  }

  return { ok: true, queued, skippedBlocked, skippedDuplicate };
}
