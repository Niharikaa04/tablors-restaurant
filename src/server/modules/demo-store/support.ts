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

const g = globalThis as unknown as { __tablorsTickets?: SupportTicket[]; __tablorsTicketN?: number };
const db = () => (g.__tablorsTickets ??= []);

export function listTickets(restaurantId: string): SupportTicket[] {
  return db()
    .filter((t) => t.restaurantId === restaurantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ ...t, messages: [...t.messages] }));
}

export function createTicket(
  restaurantId: string,
  input: { type: TicketType; subject: string; description: string; deviceId: string | null }
): SupportTicket {
  g.__tablorsTicketN = (g.__tablorsTicketN ?? 1000) + 1;
  const now = new Date().toISOString();
  const t: SupportTicket = {
    id: `TKT-${g.__tablorsTicketN}`,
    restaurantId,
    ...input,
    status: "open",
    createdAt: now,
    updatedAt: now,
    messages: [{ from: "restaurant", text: input.description, at: now }],
  };
  db().push(t);
  return { ...t };
}

export function addTicketMessage(restaurantId: string, id: string, text: string): boolean {
  const t = db().find((x) => x.restaurantId === restaurantId && x.id === id);
  if (!t || t.status === "resolved") return false;
  const now = new Date().toISOString();
  t.messages.push({ from: "restaurant", text, at: now });
  t.updatedAt = now;
  return true;
}

export function setTicketStatus(restaurantId: string, id: string, status: TicketStatus): boolean {
  const t = db().find((x) => x.restaurantId === restaurantId && x.id === id);
  if (!t) return false;
  t.status = status;
  t.updatedAt = new Date().toISOString();
  return true;
}
