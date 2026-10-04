import type { StaffRole } from "@/server/modules/auth/demo-auth";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";

/**
 * DEMO staff data (in-memory). Every function takes restaurantId first and
 * filters by it, so one restaurant can never read or change another's staff.
 * restaurantId must always come from the server session, never the browser.
 *
 * NOTE: this lives in its own file because store.ts was not available when
 * this was written. It uses the same in-memory demo approach; merge it into
 * store.ts if you want a single store module.
 */

export type StaffStatus = "active" | "inactive";

export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  contact: string; // email or phone
  role: StaffRole;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

export interface StaffInput {
  name: string;
  contact: string;
  role: StaffRole;
  status: StaffStatus;
}

const OTHER_RESTAURANT_ID = "demo-restaurant-b";

function seed(): StaffMember[] {
  const now = Date.now();
  const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
  const make = (
    id: string,
    restaurantId: string,
    name: string,
    contact: string,
    role: StaffRole,
    status: StaffStatus,
    createdHoursAgo: number,
    activeHoursAgo: number | null
  ): StaffMember => ({
    id,
    restaurantId,
    name,
    contact,
    role,
    status,
    createdAt: ago(createdHoursAgo),
    updatedAt: ago(createdHoursAgo),
    lastActiveAt: activeHoursAgo === null ? null : ago(activeHoursAgo),
  });

  return [
    make("staff_seed_1", DEMO_RESTAURANT_ID, "Demo Owner", "owner@tablors.demo", "owner", "active", 720, 1),
    make("staff_seed_2", DEMO_RESTAURANT_ID, "Meera Rao", "meera@tablors.demo", "manager", "active", 600, 5),
    make("staff_seed_3", DEMO_RESTAURANT_ID, "Arjun Das", "+91 98765 43210", "cashier", "active", 500, 3),
    make("staff_seed_4", DEMO_RESTAURANT_ID, "Kiran Babu", "kiran@tablors.demo", "kitchen", "active", 400, 2),
    make("staff_seed_5", DEMO_RESTAURANT_ID, "Ravi Teja", "+91 91234 56789", "waiter", "inactive", 300, 200),
    // A second restaurant, so tenant isolation is visible when testing.
    make("staff_seed_b1", OTHER_RESTAURANT_ID, "Restaurant B Owner", "owner@restaurant-b.demo", "owner", "active", 100, 4),
  ];
}

// globalThis keeps the data across Next.js hot reloads in dev.
const globalStore = globalThis as unknown as { __tablorsStaff?: StaffMember[] };
function db(): StaffMember[] {
  return (globalStore.__tablorsStaff ??= seed());
}

export function listStaff(restaurantId: string): StaffMember[] {
  return db()
    .filter((m) => m.restaurantId === restaurantId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ ...m }));
}

export function getStaff(restaurantId: string, id: string): StaffMember | undefined {
  const found = db().find((m) => m.restaurantId === restaurantId && m.id === id);
  return found ? { ...found } : undefined;
}

export function countActiveOwners(restaurantId: string): number {
  return db().filter(
    (m) => m.restaurantId === restaurantId && m.role === "owner" && m.status === "active"
  ).length;
}

export function isContactTaken(restaurantId: string, contact: string, exceptId?: string): boolean {
  const wanted = contact.trim().toLowerCase();
  return db().some(
    (m) =>
      m.restaurantId === restaurantId &&
      m.id !== exceptId &&
      m.contact.trim().toLowerCase() === wanted
  );
}

export function createStaff(restaurantId: string, input: StaffInput): StaffMember {
  const now = new Date().toISOString();
  const member: StaffMember = {
    id: `staff_${crypto.randomUUID()}`,
    restaurantId,
    name: input.name,
    contact: input.contact,
    role: input.role,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: null,
  };
  db().push(member);
  return { ...member };
}

export function updateStaff(
  restaurantId: string,
  id: string,
  patch: Partial<StaffInput>
): StaffMember | undefined {
  const found = db().find((m) => m.restaurantId === restaurantId && m.id === id);
  if (!found) return undefined;
  if (patch.name !== undefined) found.name = patch.name;
  if (patch.contact !== undefined) found.contact = patch.contact;
  if (patch.role !== undefined) found.role = patch.role;
  if (patch.status !== undefined) found.status = patch.status;
  found.updatedAt = new Date().toISOString();
  return { ...found };
}

export function deleteStaff(restaurantId: string, id: string): boolean {
  const list = db();
  const index = list.findIndex((m) => m.restaurantId === restaurantId && m.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}