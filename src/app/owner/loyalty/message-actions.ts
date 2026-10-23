"use server";

import { revalidatePath } from "next/cache";

import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { queueMemberMessagesDb } from "@/server/modules/loyalty-db/messages";

export type MessageState =
  | { status: "idle" }
  | { status: "ok"; text: string }
  | { status: "error"; text: string };

export async function sendMemberMessageAction(
  _prev: MessageState,
  formData: FormData,
): Promise<MessageState> {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "loyalty")) {
    return { status: "error", text: "You don't have access to loyalty." };
  }

  const ids = formData.getAll("memberId").map(String);
  const result = await queueMemberMessagesDb(
    session.restaurantId,
    ids,
    String(formData.get("message") ?? ""),
  );
  if (!result.ok) return { status: "error", text: result.error };

  revalidatePath("/owner/loyalty");
  const extras = [
    result.skippedDuplicate ? `${result.skippedDuplicate} already had this message` : "",
    result.skippedBlocked ? `${result.skippedBlocked} blocked` : "",
  ].filter(Boolean);
  return {
    status: "ok",
    text: `Message queued for ${result.queued} member${result.queued === 1 ? "" : "s"}${
      extras.length ? ` (${extras.join(", ")} skipped)` : ""
    }. No SMS provider is connected yet, so nothing is delivered until one is.`,
  };
}
