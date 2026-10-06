"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { DemoRole } from "@/server/modules/auth/demo-auth";
import type { MenuItem, Order, RestaurantTable } from "@/server/modules/demo-store/store";
import { advanceOrder } from "@/server/modules/orders/actions";
import { toggleItemAvailability } from "@/server/modules/menu/actions";
import {
  KITCHEN_STATUSES,
  type KitchenStatus,
  isKitchenStatus,
} from "./kitchen-utils";
import { KitchenHeader } from "./kitchen-header";
import { OrderSummaryStrip } from "./order-summary-strip";
import { OrderColumn } from "./order-column";
import { OrderDetailsPanel } from "./order-details-panel";
import { MenuAvailabilityPanel } from "./menu-availability-panel";

// Priority used to auto-select a sensible default order when nothing
// is selected yet — the order a chef would most want to see first.
const DEFAULT_SELECTION_PRIORITY: KitchenStatus[] = ["ready", "preparing", "new", "served"];

export function KitchenDashboard({
  orders,
  tables,
  menu,
  role,
  signOutAction,
}: {
  orders: Order[];
  tables: RestaurantTable[];
  menu: MenuItem[];
  role: DemoRole;
  signOutAction: () => Promise<void>;
}) {
  const [, startTransition] = useTransition();

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<KitchenStatus | "all">("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sortDirByStatus, setSortDirByStatus] = useState<Record<KitchenStatus, "asc" | "desc">>({
    new: "asc",
    preparing: "asc",
    ready: "asc",
    served: "desc",
  });

  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [togglingCode, setTogglingCode] = useState<string | null>(null);

  const tablesById = useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);
  // Keyed by stable item id (order lines resolve through it, so an owner
  // code edit can't misattribute old orders) and by code (fallback for
  // lines without an id).
  const menuByCode = useMemo(
    () => new Map<string, MenuItem>(menu.flatMap((m) => [[m.id, m], [m.code, m]] as [string, MenuItem][])),
    [menu]
  );

  // The kitchen never deals with billed orders — that's a billing
  // concern handled in the owner portal.
  const activeOrders = useMemo(() => orders.filter((o) => isKitchenStatus(o.status)), [orders]);

  const counts = useMemo(() => {
    const base: Record<KitchenStatus, number> = { new: 0, preparing: 0, ready: 0, served: 0 };
    for (const order of activeOrders) {
      // activeOrders is already filtered to non-billed, but the
      // element type is still the general Order type, so guard the
      // index explicitly rather than relying on narrowing here.
      if (order.status === "billed") continue;
      base[order.status] += 1;
    }
    return base;
  }, [activeOrders]);

  const searchedOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeOrders.filter((order) => {
      if (tableFilter !== "all" && order.tableId !== tableFilter) return false;
      if (query.length === 0) return true;
      const table = tablesById.get(order.tableId);
      const haystack = [order.id, table?.label ?? order.tableId, ...order.lines.map((l) => l.name)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [activeOrders, search, tableFilter, tablesById]);

  // Auto-pick a sensible order to show in Order Details once one
  // becomes available, and drop the selection if that order leaves
  // the active list (served → billed, etc.).
  useEffect(() => {
    if (selectedOrderId && activeOrders.some((o) => o.id === selectedOrderId)) return;
    for (const status of DEFAULT_SELECTION_PRIORITY) {
      const match = activeOrders.find((o) => o.status === status);
      if (match) {
        setSelectedOrderId(match.id);
        return;
      }
    }
    setSelectedOrderId(null);
  }, [activeOrders, selectedOrderId]);

  const selectedOrder = selectedOrderId ? (orders.find((o) => o.id === selectedOrderId) ?? null) : null;

  function handleAdvance(orderId: string) {
    if (advancingId) return;
    setAdvancingId(orderId);
    startTransition(async () => {
      try {
        await advanceOrder(orderId);
      } finally {
        setAdvancingId(null);
      }
    });
  }

  function handleToggleAvailability(code: string, nextAvailable: boolean) {
    if (togglingCode) return;
    setTogglingCode(code);
    startTransition(async () => {
      try {
        await toggleItemAvailability(code, nextAvailable);
      } finally {
        setTogglingCode(null);
      }
    });
  }

  const visibleStatuses = statusFilter === "all" ? KITCHEN_STATUSES : [statusFilter];

  return (
    <div className="tablor-kitchen min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <KitchenHeader
        tables={tables}
        search={search}
        onSearchChange={setSearch}
        tableFilter={tableFilter}
        onTableFilterChange={setTableFilter}
        signOutAction={signOutAction}
      />

      <div className="mt-5">
        <OrderSummaryStrip
          counts={counts}
          total={activeOrders.length}
          activeFilter={statusFilter}
          onSelectFilter={setStatusFilter}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5">
          <div
            className={`grid gap-4 ${
              visibleStatuses.length === 1 ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-4"
            }`}
          >
            {visibleStatuses.map((status) => (
              <OrderColumn
                key={status}
                status={status}
                orders={searchedOrders.filter((o) => o.status === status)}
                tablesById={tablesById}
                menuByCode={menuByCode}
                now={now}
                selectedOrderId={selectedOrderId}
                onSelectOrder={setSelectedOrderId}
                advancingId={advancingId}
                onAdvance={handleAdvance}
                togglingCode={togglingCode}
                onToggleAvailability={handleToggleAvailability}
                sortDir={sortDirByStatus[status]}
                onChangeSortDir={(dir) =>
                  setSortDirByStatus((prev) => ({ ...prev, [status]: dir }))
                }
              />
            ))}
          </div>

          <OrderDetailsPanel
            order={selectedOrder}
            table={selectedOrder ? tablesById.get(selectedOrder.tableId) : undefined}
            menuByCode={menuByCode}
            now={now}
            togglingCode={togglingCode}
            onToggleAvailability={handleToggleAvailability}
          />
        </div>

        <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-11rem)]">
          <MenuAvailabilityPanel
            menu={menu}
            togglingCode={togglingCode}
            onToggleAvailability={handleToggleAvailability}
            canOpenFullMenu={role === "owner" || role === "admin"}
          />
        </div>
      </div>
    </div>
  );
}
