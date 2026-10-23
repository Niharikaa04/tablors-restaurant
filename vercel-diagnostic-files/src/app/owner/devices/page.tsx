import { redirect } from "next/navigation";

import { requirePermission } from "@/server/modules/auth/session";

/**
 * Devices now live in the merged "Tables & Devices" tab. This route stays
 * so existing links (notification bell, notification feed, device health
 * panel) keep working.
 */
export default async function DevicesPage() {
  await requirePermission("devices");
  redirect("/owner/tables");
}