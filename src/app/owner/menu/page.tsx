import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import {
  getMenuDb,
  getMenuItemUsageDb,
} from "@/server/modules/data/menu-db";
import { MenuManager } from "./menu-manager";

/**
 * Owner → Menu. Reads the ONE canonical menu (getMenu()) that the kitchen,
 * customer menu and table devices also read; all edits go through the
 * owner-authorized server actions in modules/menu/actions.
 */
export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  return (
    <MenuManager
      items={await getMenuDb(DEMO_RESTAURANT_ID)}
      usage={await getMenuItemUsageDb(DEMO_RESTAURANT_ID)}
      initialCategory={category ?? null}
    />
  );
}
