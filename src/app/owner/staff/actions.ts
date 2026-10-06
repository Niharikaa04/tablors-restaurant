"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { StaffRole } from "@/server/modules/auth/demo-auth";
import { canActOnStaffRole, hasPermission } from "@/server/modules/auth/permissions";
import { getDemoSession, type DemoSession } from "@/server/modules/auth/session";
import {
  countActiveOwners,
  createStaff,
  deleteStaff,
  getStaff,
  isContactTaken,
  updateStaff,
  type StaffInput,
} from "@/server/modules/demo-store/staff";

export type StaffActionResult = { ok: true } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9][0-9\s-]{6,14}$/;

const roleSchema = z.enum(["owner", "manager", "cashier", "kitchen", "waiter"]);
const statusSchema = z.enum(["active", "inactive"]);
const idSchema = z.string().min(1).max(100);
const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name is too long");
const contactSchema = z
  .string()
  .trim()
  .min(5, "Enter an email or phone number")
  .max(120, "Email or phone is too long")
  .refine((v) => EMAIL.test(v) || PHONE.test(v), "Enter a valid email or phone number");

function normalizeContact(value: string): string {
  const v = value.trim();
  return EMAIL.test(v) ? v.toLowerCase() : v;
}

function fail(error: string): StaffActionResult {
  return { ok: false, error };
}

// Every action re-checks the session on the server. Role and restaurantId
// are NEVER read from the request; the UI's hints are not trusted.
type AuthResult =
  | { ok: true; session: DemoSession }
  | { ok: false; error: string };

async function authorize(): Promise<AuthResult> {
  const session = await getDemoSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!hasPermission(session.role, "staff")) {
    return { ok: false, error: "You do not have access to staff management." };
  }
  return { ok: true, session };
}

export async function addStaffAction(input: unknown): Promise<StaffActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsed = z
    .object({ name: nameSchema, contact: contactSchema, role: roleSchema, status: statusSchema })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");

  const data = parsed.data;
  if (!canActOnStaffRole(session.role, data.role)) {
    return fail("You are not allowed to assign that role.");
  }
  const contact = normalizeContact(data.contact);
  if (isContactTaken(session.restaurantId, contact)) {
    return fail("A staff member with that email or phone already exists.");
  }

  createStaff(session.restaurantId, { ...data, contact });
  revalidatePath("/owner/staff");
  return { ok: true };
}

async function updateMember(
  rawId: unknown,
  patch: Partial<StaffInput>
): Promise<StaffActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const id = idSchema.safeParse(rawId);
  if (!id.success) return fail("Invalid staff member.");

  // Lookup is scoped to the session's restaurant, so another restaurant's
  // staff id simply "does not exist" here.
  const member = getStaff(session.restaurantId, id.data);
  if (!member) return fail("Staff member not found.");

  if (!canActOnStaffRole(session.role, member.role)) {
    return fail("You are not allowed to modify this staff member.");
  }
  if (patch.role !== undefined && !canActOnStaffRole(session.role, patch.role)) {
    return fail("You are not allowed to assign that role.");
  }

  const losesActiveOwner =
    member.role === "owner" &&
    member.status === "active" &&
    ((patch.role !== undefined && patch.role !== "owner") || patch.status === "inactive");
  if (losesActiveOwner && countActiveOwners(session.restaurantId) <= 1) {
    return fail("There must always be at least one active Owner.");
  }

  if (patch.contact !== undefined && isContactTaken(session.restaurantId, patch.contact, member.id)) {
    return fail("A staff member with that email or phone already exists.");
  }

  updateStaff(session.restaurantId, member.id, patch);
  revalidatePath("/owner/staff");
  return { ok: true };
}

export async function editStaffAction(id: unknown, input: unknown): Promise<StaffActionResult> {
  const parsed = z
    .object({ name: nameSchema, contact: contactSchema, role: roleSchema })
    .safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  return updateMember(id, {
    name: parsed.data.name,
    contact: normalizeContact(parsed.data.contact),
    role: parsed.data.role as StaffRole,
  });
}

export async function changeStaffRoleAction(id: unknown, role: unknown): Promise<StaffActionResult> {
  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return fail("Invalid role.");
  return updateMember(id, { role: parsed.data });
}

export async function setStaffStatusAction(id: unknown, status: unknown): Promise<StaffActionResult> {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return fail("Invalid status.");
  return updateMember(id, { status: parsed.data });
}

export async function deleteStaffAction(id: unknown): Promise<StaffActionResult> {
  const auth = await authorize();
  if (!auth.ok) return fail(auth.error);
  const { session } = auth;

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Invalid staff member.");

  // Scoped to the session's restaurant: another restaurant's id is "not found".
  const member = getStaff(session.restaurantId, parsedId.data);
  if (!member) return fail("Staff member not found.");

  if (!canActOnStaffRole(session.role, member.role)) {
    return fail("You are not allowed to delete this staff member.");
  }
  if (
    member.role === "owner" &&
    member.status === "active" &&
    countActiveOwners(session.restaurantId) <= 1
  ) {
    return fail("There must always be at least one active Owner.");
  }

  deleteStaff(session.restaurantId, member.id);
  revalidatePath("/owner/staff");
  return { ok: true };
}