import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getMenuDb } from "@/server/modules/data/menu-db";
import { CustomerMenuView } from "@/components/customer/customer-menu-view";

/**
 * Customer digital menu — read-only browse (Feature 1).
 *
 * No table/restaurant identification, no cart, no ordering yet.
 * Menu data comes straight from the existing demo store; nothing is
 * invented or hardcoded here.
 */
export const dynamic = "force-dynamic";

export default async function CustomerMenuPage() {
  const menu = await getMenuDb(DEMO_RESTAURANT_ID);

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-[var(--tablor-text-primary)] sm:text-2xl">
          Menu
        </h1>
        <p className="mt-1 text-sm text-[var(--tablor-text-muted)]">
          Browse today&apos;s menu.
        </p>
      </div>

      <div className="mt-6">
        <CustomerMenuView items={menu} />
      </div>
    </div>
  );
}
