import { getMenu, getMenuItemUsage } from "@/server/modules/demo-store/store";
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
      items={getMenu()}
      usage={getMenuItemUsage()}
      initialCategory={category ?? null}
    />
  );
}
