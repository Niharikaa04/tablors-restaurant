import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoRole, roleHome, SESSION_COOKIE, type DemoRole } from "./demo-auth";
import { hasPermission, type Permission } from "./permissions";

/**
 * DEMO ONLY: the demo has a single restaurant and the session carries no
 * restaurant id, so every session maps to this constant, derived on the
 * server. Never read a restaurantId from the browser. Phase 2 replaces this
 * with the restaurant id stored on a DB-backed session.
 */
export const DEMO_RESTAURANT_ID = "demo-restaurant";

export async function getDemoRole(): Promise<DemoRole | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  return isDemoRole(value) ? value : null;
}

export type DemoSession = { role: DemoRole; restaurantId: string };

export async function getDemoSession(): Promise<DemoSession | null> {
  const role = await getDemoRole();
  return role ? { role, restaurantId: DEMO_RESTAURANT_ID } : null;
}

/**
 * Page/server-action guard. Unauthenticated -> /login. Signed in without the
 * permission -> that role's own home. Call it in every protected page and
 * action: layouts do not re-run on client-side navigation between children.
 */
export async function requirePermission(permission: Permission): Promise<DemoSession> {
  const session = await getDemoSession();
  if (!session) redirect("/login");
  if (!hasPermission(session.role, permission)) redirect(roleHome[session.role]);
  return session;
}