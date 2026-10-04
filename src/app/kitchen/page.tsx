import { redirect } from "next/navigation";
import { getDemoRole } from "@/server/modules/auth/session";
import { demoLogout } from "@/server/modules/auth/demo-actions";
import { getMenu, getOrders, getTables } from "@/server/modules/demo-store/store";
import { KitchenDashboard } from "@/components/kitchen/kitchen-dashboard";
import { LiveRefresh } from "@/components/live/live-refresh";

export default async function KitchenPage() {
  const role = await getDemoRole();
  if (role !== "kitchen" && role !== "owner") {
    redirect("/login");
  }

  const orders = getOrders();
  const tables = getTables();
  const menu = getMenu();

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