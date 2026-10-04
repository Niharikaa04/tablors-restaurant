import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDemoSession } from "@/server/modules/auth/session";
import { roleHome } from "@/server/modules/auth/demo-auth";
import { OWNER_ROUTE_PERMISSION, hasPermission } from "@/server/modules/auth/permissions";
import { demoLogout } from "@/server/modules/auth/demo-actions";
import { Crown, LogOut } from "lucide-react";
import { getSettings } from "@/server/modules/demo-store/settings";
import { OwnerSidebarNav } from "./owner-sidebar-nav";

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const session = await getDemoSession();
  if (!session) {
    redirect("/login");
  }

  // Which Owner Portal areas this role may open (also filters the sidebar).
  const allowedHrefs = Object.entries(OWNER_ROUTE_PERMISSION)
    .filter(([, permission]) => hasPermission(session.role, permission))
    .map(([href]) => href);

  // Roles with no Owner Portal access (kitchen, admin) go to their own home.
  if (allowedHrefs.length === 0) {
    redirect(roleHome[session.role]);
  }

  const settings = getSettings(session.restaurantId);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-black text-zinc-100 overflow-x-hidden">
      {/* Sidebar - Responsive for Mobile & Tablet */}
      <aside className="relative w-full md:w-64 bg-zinc-950 border-r border-zinc-800 shrink-0 flex flex-col justify-between p-4 md:p-6 md:min-h-screen overflow-hidden">
        {/* ambient neon glow behind the logo, purely decorative */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-[var(--radium-green)] opacity-[0.08] blur-[80px]"
        />

        <div className="relative">
          {/* Header & Neon Branding */}
          <div className="flex items-center justify-between md:justify-start space-x-3 pb-6 border-b border-zinc-900">
            <Link href={roleHome[session.role]} className="flex items-center space-x-3 group">
              {settings.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logoDataUrl}
                  alt={`${settings.name} logo`}
                  className="h-8 w-8 rounded object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <Crown
                  className="w-7 h-7 text-[var(--radium-green)] transition-transform group-hover:scale-105"
                  style={{ filter: "drop-shadow(0 0 6px var(--radium-green))" }}
                />
              )}
              <div>
                <span
                  className="font-bold text-xl tracking-wider text-zinc-50 font-serif"
                  style={{ textShadow: "0 0 18px rgba(57,255,106,0.35)" }}
                >
                  {settings.name}
                </span>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-sans">
                  Owner Portal
                </p>
              </div>
            </Link>
          </div>

          <OwnerSidebarNav allowedHrefs={allowedHrefs} />
        </div>

        {/* Logout Form & Status */}
        <div className="relative mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between md:flex-col md:items-start md:space-y-4">
          <form action={demoLogout} className="w-full">
            <button
              type="submit"
              className="flex items-center space-x-2.5 w-full rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </form>

          <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-500 px-3">
            <span
              className="h-2 w-2 rounded-full bg-[var(--radium-green)] animate-pulse"
              style={{ boxShadow: "0 0 8px var(--radium-green)" }}
            />
            <span>System Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-black p-4 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}