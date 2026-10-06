"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession } from "@/server/modules/auth/session";
import { addTicketMessage, createTicket, setTicketStatus } from "@/server/modules/demo-store/support";

export type SupportActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): SupportActionResult => ({ ok: false, error });

async function authorize() {
  const session = await getDemoSession();
  if (!session || !hasPermission(session.role, "support")) return null;
  return session;
}

const createSchema = z.object({
  type: z.enum(["device_problem", "replacement", "software_issue", "installation", "chat"]),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(120),
  description: z.string().trim().min(10, "Please describe the issue (min 10 characters)").max(2000),
  deviceId: z.string().max(100).nullable(),
});

export async function createTicketAction(input: unknown): Promise<SupportActionResult> {
  const session = await authorize();
  if (!session) return fail("You do not have access to support.");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  createTicket(session.restaurantId, parsed.data);
  revalidatePath("/owner/support");
  return { ok: true };
}

export async function replyTicketAction(id: unknown, text: unknown): Promise<SupportActionResult> {
  const session = await authorize();
  if (!session) return fail("You do not have access to support.");
  const p = z.object({ id: z.string().min(1).max(50), text: z.string().trim().min(1).max(2000) }).safeParse({ id, text });
  if (!p.success) return fail("Enter a message.");
  if (!addTicketMessage(session.restaurantId, p.data.id, p.data.text)) return fail("Ticket not found or already resolved.");
  revalidatePath("/owner/support");
  return { ok: true };
}

export async function closeTicketAction(id: unknown): Promise<SupportActionResult> {
  const session = await authorize();
  if (!session) return fail("You do not have access to support.");
  const p = z.string().min(1).max(50).safeParse(id);
  if (!p.success) return fail("Invalid ticket.");
  if (!setTicketStatus(session.restaurantId, p.data, "resolved")) return fail("Ticket not found.");
  revalidatePath("/owner/support");
  return { ok: true };
}
