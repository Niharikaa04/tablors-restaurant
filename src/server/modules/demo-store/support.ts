import "server-only";

import { getDoc, listDocs, putDoc } from "@/server/modules/data/documents";

/** DEMO support-ticket store (in-memory). Every function takes restaurantId first. */

export const TICKET_TYPES = [
  { value: "device_problem", label: "Device problem" },
  { value: "replacement", label: "Replacement request" },
  { value: "software_issue", label: "Software issue" },
  { value: "installation", label: "Installation request" },
  { value: "chat", label: "Chat / general support" },
] as const;

export type TicketType = (typeof TICKET_TYPES)[number]["value"];
export type TicketStatus = "open" | "in_progress" | "resolved";

export interface SupportMessage {
  from: "restaurant" | "support";
  text: string;
  at: string;
}

export interface SupportTicket {
  id: string;
  restaurantId: string;
  type: TicketType;
  subject: string;
  description: string;
  deviceId: string | null;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

const COLLECTION = "support_tickets";

export async function listTickets(restaurantId: string): Promise<SupportTicket[]> {
  const docs = await listDocs<SupportTicket>(restaurantId, COLLECTION);
  return docs
    .map((d) => d.data)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createTicket(
  restaurantId: string,
  input: { type: TicketType; subject: string; description: string; deviceId: string | null },
): Promise<SupportTicket> {
  const existing = await listDocs<SupportTicket>(restaurantId, COLLECTION);
  const highest = existing.reduce((max, d) => {
    const n = Number(d.id.replace("TKT-", ""));
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 1000);
  const now = new Date().toISOString();
  const t: SupportTicket = {
    id: `TKT-${highest + 1}`,
    restaurantId,
    ...input,
    status: "open",
    createdAt: now,
    updatedAt: now,
    messages: [{ from: "restaurant", text: input.description, at: now }],
  };
  await putDoc(restaurantId, COLLECTION, t.id, t);
  return t;
}

export async function addTicketMessage(
  restaurantId: string,
  id: string,
  text: string,
): Promise<boolean> {
  const t = await getDoc<SupportTicket>(restaurantId, COLLECTION, id);
  if (!t || t.status === "resolved") return false;
  const now = new Date().toISOString();
  t.messages.push({ from: "restaurant", text, at: now });
  t.updatedAt = now;
  await putDoc(restaurantId, COLLECTION, id, t);
  return true;
}

export async function setTicketStatus(
  restaurantId: string,
  id: string,
  status: TicketStatus,
): Promise<boolean> {
  const t = await getDoc<SupportTicket>(restaurantId, COLLECTION, id);
  if (!t) return false;
  t.status = status;
  t.updatedAt = new Date().toISOString();
  await putDoc(restaurantId, COLLECTION, id, t);
  return true;
}
