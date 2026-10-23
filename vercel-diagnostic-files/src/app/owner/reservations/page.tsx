import { redirect } from "next/navigation";
import { requirePermission } from "@/server/modules/auth/session";

export default async function ReservationsPage() {
  await requirePermission("reservations");
  redirect("/owner/tables#reservations");
}