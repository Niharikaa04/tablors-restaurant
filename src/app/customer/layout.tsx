import type { ReactNode } from "react";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";

/**
 * Customer-facing layout for the physical table device.
 *
 * Intentionally minimal: no sidebar, no owner-only navigation, no
 * dashboard chrome. Sized and styled for a tablet-class touchscreen
 * mounted at the table, not a desktop admin surface.
 *
 * Uses the new Tablor's lime/olive-black tokens (see globals.css,
 * `.tablor-customer`), scoped to this route tree only so the rest of
 * the app (marketing/owner/kitchen) is unaffected.
 */
// Customer pages have no login, so the restaurant id comes from the server (demo: single restaurant).
export default function CustomerLayout({ children }: { children: ReactNode }) {
  const settings = getSettings(DEMO_RESTAURANT_ID);

  return (
    <div className="tablor-customer min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--tablor-border)] bg-[var(--tablor-bg)]/95 backdrop-blur px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          {settings.logoDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoDataUrl} alt="" className="h-8 w-8 rounded object-cover" />
          )}
          <p className="text-lg font-semibold tracking-wide text-[var(--tablor-text-primary)]">
            {settings.name}
          </p>
        </div>
      </header>

      <main className="px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
