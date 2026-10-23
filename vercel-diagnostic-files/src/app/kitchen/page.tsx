import { redirect } from "next/navigation";
import { getDemoRole } from "@/server/modules/auth/session";
import { demoLogout } from "@/server/modules/auth/demo-actions";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import { getMenuIncludingArchivedDb } from "@/server/modules/data/menu-db";
import { getTablesDb } from "@/server/modules/data/tables-db";
import { listActiveOrders } from "@/server/modules/orders/db-orders";
import { KitchenDashboard } from "@/components/kitchen/kitchen-dashboard";
import { LiveRefresh } from "@/components/live/live-refresh";

export default async function KitchenPage() {
  const role = await getDemoRole();
  if (role !== "kitchen" && role !== "owner") {
    redirect("/login");
  }

  // Independent queries run together, not one after another.
  const [orders, tables, menu] = await Promise.all([
    listActiveOrders(DEMO_RESTAURANT_ID),
    getTablesDb(DEMO_RESTAURANT_ID),
    getMenuIncludingArchivedDb(DEMO_RESTAURANT_ID),
  ]);

  return (
    <>
      <LiveRefresh />

      <KitchenDashboard
        orders={orders}
        tables={tables}
        menu={menu}
        role={role}
        signOutAction={demoLogout}
      />
    </>
  );
}