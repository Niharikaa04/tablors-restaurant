import type { StaffRole } from "@/server/modules/auth/demo-auth";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";

/**
 * DEMO staff data (in-memory). Every function takes restaurantId first and
 * filters by it, so one restaurant can never read or change another's staff.
 * restaurantId must always come from the server session, never the browser.
 */

export type StaffStatus = "active" | "inactive";
export type LeaveType = "casual" | "sick" | "unpaid";

export interface StaffMember {
  id: string;
  restaurantId: string;
  name: string;
  contact: string; // email or phone
  role: StaffRole;
  status: StaffStatus;
  joinedOn: string | null; // yyyy-mm-dd
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

export interface StaffInput {
  name: string;
  contact: string;
  role: StaffRole;
  status: StaffStatus;
  joinedOn: string | null;
}

export interface Leave {
  id: string;
  restaurantId: string;
  staffId: string;
  type: LeaveType;
  from: string; // yyyy-mm-dd, inclusive
  to: string; // yyyy-mm-dd, inclusive
  reason: string;
  createdAt: string;
}

export interface LeaveInput {
  staffId: string;
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
}

const OTHER_RESTAURANT_ID = "demo-restaurant-b";

/** Today's date (yyyy-mm-dd) in the restaurant's time zone. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

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
    joinedOn: null, // not set until the owner fills it in
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
const globalStore = globalThis as unknown as {
  __tablorsStaff?: StaffMember[];
  __tablorsLeaves?: Leave[];
};
function db(): StaffMember[] {
  return (globalStore.__tablorsStaff ??= seed());
}
function leaveDb(): Leave[] {
  return (globalStore.__tablorsLeaves ??= []);
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
    joinedOn: input.joinedOn,
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
  if (patch.joinedOn !== undefined) found.joinedOn = patch.joinedOn;
  found.updatedAt = new Date().toISOString();
  return { ...found };
}

export function deleteStaff(restaurantId: string, id: string): boolean {
  const list = db();
  const index = list.findIndex((m) => m.restaurantId === restaurantId && m.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  // Their leave records go with them.
  const leaves = leaveDb();
  for (let i = leaves.length - 1; i >= 0; i -= 1) {
    if (leaves[i].restaurantId === restaurantId && leaves[i].staffId === id) leaves.splice(i, 1);
  }
  return true;
}

/* ------------------------------ Leaves ------------------------------ */

export function listLeaves(restaurantId: string): Leave[] {
  return leaveDb()
    .filter((l) => l.restaurantId === restaurantId)
    .sort((a, b) => b.from.localeCompare(a.from))
    .map((l) => ({ ...l }));
}

export function getLeave(restaurantId: string, id: string): Leave | undefined {
  const found = leaveDb().find((l) => l.restaurantId === restaurantId && l.id === id);
  return found ? { ...found } : undefined;
}

export function hasLeaveOverlap(
  restaurantId: string,
  staffId: string,
  from: string,
  to: string
): boolean {
  return leaveDb().some(
    (l) =>
      l.restaurantId === restaurantId &&
      l.staffId === staffId &&
      l.from <= to &&
      from <= l.to
  );
}

export function addLeave(restaurantId: string, input: LeaveInput): Leave {
  const leave: Leave = {
    id: `leave_${crypto.randomUUID()}`,
    restaurantId,
    staffId: input.staffId,
    type: input.type,
    from: input.from,
    to: input.to,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
  leaveDb().push(leave);
  return { ...leave };
}

export function deleteLeave(restaurantId: string, id: string): boolean {
  const list = leaveDb();
  const index = list.findIndex((l) => l.restaurantId === restaurantId && l.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}