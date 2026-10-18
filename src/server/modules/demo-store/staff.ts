import "server-only";

import { deleteDoc, getDoc, listDocs, putDoc } from "@/server/modules/data/documents";
import type { StaffRole } from "@/server/modules/auth/demo-auth";

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

export function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const STAFF = "staff";
const LEAVES = "staff_leaves";

// Staff start empty: no demo/fake people are ever written to a real database.

export async function listStaff(restaurantId: string): Promise<StaffMember[]> {
  return (await listDocs<StaffMember>(restaurantId, STAFF))
    .map((d) => d.data)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getStaff(restaurantId: string, id: string): Promise<StaffMember | undefined> {
  return (await getDoc<StaffMember>(restaurantId, STAFF, id)) ?? undefined;
}

export async function countActiveOwners(restaurantId: string): Promise<number> {
  return (await listStaff(restaurantId)).filter(
    (m) => m.role === "owner" && m.status === "active",
  ).length;
}

export async function isContactTaken(
  restaurantId: string,
  contact: string,
  exceptId?: string,
): Promise<boolean> {
  const wanted = contact.trim().toLowerCase();
  return (await listStaff(restaurantId)).some(
    (m) => m.id !== exceptId && m.contact.trim().toLowerCase() === wanted,
  );
}

export async function createStaff(restaurantId: string, input: StaffInput): Promise<StaffMember> {
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
  await putDoc(restaurantId, STAFF, member.id, member);
  return member;
}

export async function updateStaff(
  restaurantId: string,
  id: string,
  patch: Partial<StaffInput>,
): Promise<StaffMember | undefined> {
  const found = await getStaff(restaurantId, id);
  if (!found) return undefined;
  const next: StaffMember = { ...found, updatedAt: new Date().toISOString() };
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.contact !== undefined) next.contact = patch.contact;
  if (patch.role !== undefined) next.role = patch.role;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.joinedOn !== undefined) next.joinedOn = patch.joinedOn;
  await putDoc(restaurantId, STAFF, id, next);
  return next;
}

export async function deleteStaff(restaurantId: string, id: string): Promise<boolean> {
  const removed = await deleteDoc(restaurantId, STAFF, id);
  if (!removed) return false;
  for (const l of await listLeaves(restaurantId)) {
    if (l.staffId === id) await deleteDoc(restaurantId, LEAVES, l.id);
  }
  return true;
}

export async function listLeaves(restaurantId: string): Promise<Leave[]> {
  return (await listDocs<Leave>(restaurantId, LEAVES))
    .map((d) => d.data)
    .sort((a, b) => b.from.localeCompare(a.from));
}

export async function getLeave(restaurantId: string, id: string): Promise<Leave | undefined> {
  return (await getDoc<Leave>(restaurantId, LEAVES, id)) ?? undefined;
}

export async function hasLeaveOverlap(
  restaurantId: string,
  staffId: string,
  from: string,
  to: string,
): Promise<boolean> {
  return (await listLeaves(restaurantId)).some(
    (l) => l.staffId === staffId && l.from <= to && from <= l.to,
  );
}

export async function addLeave(restaurantId: string, input: LeaveInput): Promise<Leave> {
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
  await putDoc(restaurantId, LEAVES, leave.id, leave);
  return leave;
}

export async function deleteLeave(restaurantId: string, id: string): Promise<boolean> {
  return deleteDoc(restaurantId, LEAVES, id);
}
