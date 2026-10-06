import { STAFF_ROLES } from "@/server/modules/auth/demo-auth";
import { canActOnStaffRole } from "@/server/modules/auth/permissions";
import { requirePermission } from "@/server/modules/auth/session";
import { listStaff } from "@/server/modules/demo-store/staff";
import { StaffManager, type StaffRow } from "./staff-manager";

// Formatted on the server in a fixed time zone so server and client render the same text.
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function StaffPage() {
  // Unauthenticated -> /login. Cashier / Kitchen / Waiter -> their own home.
  const session = await requirePermission("staff");

  const rows: StaffRow[] = listStaff(session.restaurantId).map((m) => ({
    id: m.id,
    name: m.name,
    contact: m.contact,
    role: m.role,
    status: m.status,
    lastActiveLabel: m.lastActiveAt ? dateFormat.format(new Date(m.lastActiveAt)) : "Never",
    // UI hint only. Every action re-checks this on the server.
    editable: canActOnStaffRole(session.role, m.role),
  }));

  const assignableRoles = STAFF_ROLES.filter((r) => canActOnStaffRole(session.role, r));

  return <StaffManager members={rows} assignableRoles={assignableRoles} />;
}