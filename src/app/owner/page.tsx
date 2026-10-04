import { requirePermission } from "@/server/modules/auth/session";
import { getSettings } from "@/server/modules/demo-store/settings";
import {
  getOrdersByCategory,
  getOrdersByHourWindow,
  getTodayOverview,
} from "@/server/modules/demo-store/store";
import { OverviewHeader } from "@/components/dashboard/overview-header";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { OrdersByCategoryChart } from "@/components/dashboard/orders-by-category-chart";
import { LiveOrdersPanel } from "@/components/dashboard/live-orders-panel";
import { RecentOrdersTable } from "@/components/dashboard/recent-orders-table";
import { TableStatusGrid } from "@/components/dashboard/table-status-grid";
import { KitchenStatusPanel } from "@/components/dashboard/kitchen-status-panel";
import { DeviceHealthPanel } from "@/components/dashboard/device-health-panel";
import { TopSellingItems } from "@/components/dashboard/top-selling-items";

export default async function OwnerDashboardPage() {
  const session = await requirePermission("overview");
  const restaurantName = getSettings(session.restaurantId).name;
  const overview = getTodayOverview();
  const hourlySeries = getOrdersByHourWindow(11);
  const categories = getOrdersByCategory();

  // Derived, not invented: a straightforward calculation from two real
  // values already returned by getTodayOverview(). Guarded against
  // divide-by-zero on a day with no orders yet.
  const averageOrderValueRupees =
    overview.ordersToday > 0
      ? Math.round(overview.salesTodayRupees / overview.ordersToday)
      : 0;

  return (
    <div className="tablor-owner-overview space-y-6">
      {/* Header + notification bell: the owner sees new alerts without opening the sidebar page */}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <OverviewHeader restaurantName={restaurantName} />
        </div>
        <NotificationBell />
      </div>

      <MetricStrip
        overview={overview}
        averageOrderValueRupees={averageOrderValueRupees}
        hourlySeries={hourlySeries}
      />

      <AttentionPanel />

      {/* Sales trend, category mix, and the floor — the at-a-glance operational picture */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SalesChart points={hourlySeries} />
        </div>

        <div className="lg:col-span-3">
          <OrdersByCategoryChart categories={categories} />
        </div>

        <div className="lg:col-span-4">
          <TableStatusGrid />
        </div>
      </div>

      {/* What's moving right now, and what's selling */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <RecentOrdersTable />
        </div>

        <div className="lg:col-span-5">
          <TopSellingItems />
        </div>
      </div>

      {/* Deeper operational detail: live tickets, kitchen load, device fleet */}
      <div className="grid gap-5 lg:grid-cols-3">
        <LiveOrdersPanel />
        <KitchenStatusPanel />
        <DeviceHealthPanel />
      </div>
    </div>
  );
}