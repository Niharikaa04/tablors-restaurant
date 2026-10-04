import { requirePermission } from "@/server/modules/auth/session";
import { listTickets } from "@/server/modules/demo-store/support";
import { getDevices, getTables } from "@/server/modules/demo-store/store";
import { SupportManager, type TicketRow } from "./support-manager";

const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function SupportPage() {
  const session = await requirePermission("support");
  const tables = getTables();

  const tickets: TicketRow[] = listTickets(session.restaurantId).map((t) => ({
    id: t.id,
    type: t.type,
    subject: t.subject,
    status: t.status,
    deviceId: t.deviceId,
    createdLabel: fmt.format(new Date(t.createdAt)),
    messages: t.messages.map((m) => ({ from: m.from, text: m.text, atLabel: fmt.format(new Date(m.at)) })),
  }));

  // Device dropdown. If your Device type has different field names, adjust here.
  const deviceOptions = getDevices().map((d) => {
    const dev = d as unknown as { id: string; tableId?: string; label?: string };
    const table = tables.find((t) => t.id === dev.tableId);
    return { id: dev.id, label: dev.label ?? table?.label ?? dev.id };
  });

  return <SupportManager tickets={tickets} deviceOptions={deviceOptions} />;
}
