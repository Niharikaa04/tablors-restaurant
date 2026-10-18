import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/server/db/client";
import { devices, leads } from "@/server/db/schema";
import type { Device, DemoLead } from "@/server/modules/demo-store/store";

/** A device that has not checked in within this window is shown offline. */
const OFFLINE_AFTER_MS =
  Math.max(10, Number(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS) || 90) * 1000;

/**
 * Devices assigned to a table, in the existing UI shape. Online state is
 * derived from the last heartbeat so a device that stopped reporting cannot
 * stay "online" forever.
 */
export async function getDevicesDb(restaurantId: string): Promise<Device[]> {
  const rows = await db
    .select()
    .from(devices)
    .where(and(eq(devices.restaurantId, restaurantId), isNotNull(devices.tableId)))
    .orderBy(asc(devices.createdAt), asc(devices.deviceUid));

  const now = Date.now();
  return rows.map((d) => {
    const seen = d.lastSeenAt ? d.lastSeenAt.getTime() : null;
    const fresh = seen !== null && now - seen <= OFFLINE_AFTER_MS;
    return {
      id: d.id,
      tableId: d.tableId as string,
      online: d.status === "online" && fresh,
      // Unknown battery is reported as full, never as a false critical alert.
      batteryPercent: d.batteryPercent ?? 100,
      lastSeenMinutesAgo:
        seen === null ? 24 * 60 : Math.max(0, Math.floor((now - seen) / 60_000)),
    };
  });
}

export async function recordLeadDb(
  lead: Omit<DemoLead, "id" | "receivedAt">,
): Promise<DemoLead> {
  const [row] = await db
    .insert(leads)
    .values({
      id: `lead_${randomUUID()}`,
      restaurantName: lead.restaurantName,
      ownerName: lead.ownerName,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      tableCount: lead.tableCount,
      restaurantType: lead.restaurantType,
    })
    .returning();
  return { ...row, receivedAt: row.receivedAt.getTime() };
}

export async function getLeadsDb(): Promise<DemoLead[]> {
  const rows = await db.select().from(leads).orderBy(desc(leads.receivedAt));
  return rows.map((r) => ({ ...r, receivedAt: r.receivedAt.getTime() }));
}
