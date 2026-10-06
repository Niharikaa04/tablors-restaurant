import type { DemoRole, StaffRole } from "./demo-auth";

/**
 * Owner Portal permissions.
 *
 * Kitchen Display lives under /kitchen with its own gate and is not part
 * of this Owner Portal permission map.
 */
export type Permission =
  | "overview"
  | "menu"
  | "tables"
  | "orders"
  | "billing"
  | "payments"
  | "pots"
  | "devices"
  | "reports"
  | "staff"
  | "reservations"
  | "offers"
  | "notifications"
  | "support"
  | "subscription"
  | "settings"
  | "feedback";

const ALL_OWNER_PORTAL: readonly Permission[] = [
  "overview",
  "menu",
  "tables",
  "orders",
  "billing",
  "payments",
  "pots",
  "devices",
  "reports",
  "staff",
  "reservations",
  "offers",
  "notifications",
  "support",
  "subscription",
  "settings",
  "feedback",
];

const ROLE_PERMISSIONS: Record<DemoRole, readonly Permission[]> = {
  owner: ALL_OWNER_PORTAL,

  manager: [
    "overview",
    "menu",
    "tables",
    "orders",
    "devices",
    "reports",
    "staff",
    "reservations",
    "offers",
    "notifications",
    "support",
    "feedback",
  ],

  // Receives payment alerts
  cashier: ["billing", "payments", "notifications"],

  // Kitchen alerts are shown on the /kitchen screen, not in the Owner Portal
  kitchen: [],

  // Receives table reservation alerts
  waiter: ["tables", "orders", "notifications"],

  admin: [],
};

export function hasPermission(
  role: DemoRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;

  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Which permission each Owner Portal route needs.
 *
 * The sidebar uses this server-computed permission list to hide links,
 * while every page/action still checks permission independently.
 */
export const OWNER_ROUTE_PERMISSION: Record<string, Permission> = {
  "/owner": "overview",
  "/owner/menu": "menu",
  "/owner/tables": "tables",
  "/owner/orders": "orders",
  "/owner/billing": "billing",
  "/owner/payments": "payments",
  "/owner/pots": "pots",
  "/owner/pots-pin": "pots",
  "/owner/devices": "devices",
  "/owner/reports": "reports",
  "/owner/staff": "staff",
  "/owner/reservations": "reservations",
  "/owner/offers": "offers",
  "/owner/notifications": "notifications",
  "/owner/feedback": "feedback",
  "/owner/support": "support",
  "/owner/subscription": "subscription",
  "/owner/settings": "settings",
};

/**
 * Staff-management rule.
 *
 * Owner may act on any role.
 * Manager may act on everything except Owner.
 * Everyone else cannot manage staff.
 */
export function canActOnStaffRole(
  actor: DemoRole,
  role: StaffRole
): boolean {
  if (actor === "owner") return true;

  if (actor === "manager") {
    return role !== "owner";
  }

  return false;
}