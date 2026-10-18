import { redirect } from "next/navigation";
import { STAFF_ROLES } from "@/server/modules/auth/demo-auth";
import { canActOnStaffRole } from "@/server/modules/auth/permissions";
import { requirePermission } from "@/server/modules/auth/session";
import { getStaffPinVerified } from "@/server/modules/auth/staff-session";
import { listLeaves, listStaff, todayInIndia } from "@/server/modules/demo-store/staff";
import { StaffManager, type LeaveRow, type StaffRow } from "./staff-manager";

// Formatted on the server in a fixed time zone so server and client render the same text.
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});
const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "UTC",
  dateStyle: "medium",
});

const fmtDay = (d: string) => dayFormat.format(new Date(`${d}T00:00:00Z`));
const dayCount = (from: string, to: string) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  ) + 1;

export default async function StaffPage() {
  // Unauthenticated -> /login. Cashier / Kitchen / Waiter -> their own home.
  const session = await requirePermission("staff");

  // PIN gate: no valid PIN session, no staff list.
  if (!(await getStaffPinVerified())) {
    redirect("/owner/staff-pin");
  }

  const today = todayInIndia();
  const [allLeaves, staffList] = await Promise.all([
    listLeaves(session.restaurantId),
    listStaff(session.restaurantId),
  ]);

  const rows: StaffRow[] = staffList.map((m) => {
    const leaves: LeaveRow[] = allLeaves
      .filter((l) => l.staffId === m.id)
      .map((l) => ({
        id: l.id,
        type: l.type,
        fromLabel: fmtDay(l.from),
        toLabel: fmtDay(l.to),
        days: dayCount(l.from, l.to),
        reason: l.reason,
        when: l.to < today ? "past" : l.from <= today ? "current" : "upcoming",
      }));

    return {
      id: m.id,
      name: m.name,
      contact: m.contact,
      role: m.role,
      status: m.status,
      lastActiveLabel: m.lastActiveAt ? dateFormat.format(new Date(m.lastActiveAt)) : "Never",
      joinedOn: m.joinedOn ?? "",
      joinedLabel: m.joinedOn ? fmtDay(m.joinedOn) : "Not set",
      onLeave: leaves.some((l) => l.when === "current"),
      leaves,
      // UI hint only. Every action re-checks this on the server.
      editable: canActOnStaffRole(session.role, m.role),
    };
  });

  const assignableRoles = STAFF_ROLES.filter((r) => canActOnStaffRole(session.role, r));

  return <StaffManager members={rows} assignableRoles={assignableRoles} />;
}