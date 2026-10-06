/**
 * DEMO AUTH — Phase "V1 demo" only.
 *
 * This is intentionally simple: a fixed set of demo credentials and a
 * signed-in-name-only cookie, so the owner/kitchen/admin dashboards can
 * be demoed without a database. It is NOT the production auth system.
 *
 * Phase 2 replaces this with: DB-backed sessions, Argon2id password/PIN
 * hashing, HttpOnly+Secure+SameSite cookies carrying an opaque session
 * id (not a role string), CSRF protection, and real RBAC enforced
 * server-side per restaurant. Do not extend this module for production.
 */

export type DemoRole =
  | "owner"
  | "manager"
  | "cashier"
  | "kitchen"
  | "waiter"
  | "admin";

/**
 * Restaurant staff roles. "admin" is the Tablor company/platform role and
 * is deliberately NOT a restaurant staff role. One role system: StaffRole
 * is derived from DemoRole, not a second list.
 */
export type StaffRole = Exclude<DemoRole, "admin">;

export const STAFF_ROLES: readonly StaffRole[] = [
  "owner",
  "manager",
  "cashier",
  "kitchen",
  "waiter",
];

const ALL_ROLES: readonly DemoRole[] = [...STAFF_ROLES, "admin"];

export function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && (ALL_ROLES as readonly string[]).includes(value);
}

export const SESSION_COOKIE = "tablors_demo_role";

export const demoCredentials: Record<DemoRole, { username: string; password: string }> = {
  owner: { username: "owner", password: "demo-owner" },
  manager: { username: "manager", password: "demo-manager" },
  cashier: { username: "cashier", password: "demo-cashier" },
  kitchen: { username: "kitchen", password: "demo-kitchen" },
  waiter: { username: "waiter", password: "demo-waiter" },
  admin: { username: "admin", password: "demo-admin" },
};

/** Where each role lands after login (and when sent away from a page they may not open). */
export const roleHome: Record<DemoRole, string> = {
  owner: "/owner",
  manager: "/owner",
  cashier: "/owner/billing",
  kitchen: "/kitchen",
  waiter: "/owner/tables",
  admin: "/admin",
};

export function checkDemoCredentials(
  username: string,
  password: string
): DemoRole | null {
  for (const [role, creds] of Object.entries(demoCredentials) as [
    DemoRole,
    { username: string; password: string },
  ][]) {
    if (creds.username === username && creds.password === password) {
      return role;
    }
  }
  return null;
}