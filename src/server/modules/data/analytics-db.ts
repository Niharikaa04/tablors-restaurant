import "server-only";

import { listAllOrders, listActiveOrders } from "@/server/modules/orders/db-orders";
import { listBillsDb } from "@/server/modules/billing/db-billing";
import { getTablesDb } from "@/server/modules/data/tables-db";
import { getDevicesDb } from "@/server/modules/data/devices-db";
import { getMenuIncludingArchivedDb } from "@/server/modules/data/menu-db";
import {
  RESTAURANT_TIME_ZONE,
  type CategoryOrders,
  type HourlyOrders,
  type ItemSalesSummary,
  type MenuItem,
  type Order,
  type OrderLine,
  type SlowOrder,
} from "@/server/modules/demo-store/store";

/**
 * Dashboard aggregates computed from PostgreSQL. Same output shapes as the
 * old in-memory helpers so dashboard components are unchanged.
 */

function istDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: RESTAURANT_TIME_ZONE });
}

function istHour(ms: number): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return Number(h) % 24;
}

function formatHourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour} ${period}`;
}

function menuLookup(menu: MenuItem[]) {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const byCode = new Map(menu.filter((m) => m.archivedAt === null).map((m) => [m.code, m]));
  return (line: OrderLine): MenuItem | null =>
    (line.itemId ? byId.get(line.itemId) : byCode.get(line.code)) ?? null;
}

export async function getTodayOverviewDb(restaurantId: string, now = Date.now()) {
  const [allOrders, bills, tables, devices] = await Promise.all([
    listAllOrders(restaurantId),
    listBillsDb(restaurantId),
    getTablesDb(restaurantId),
    getDevicesDb(restaurantId),
  ]);
  const today = istDay(now);
  const active = allOrders.filter((o) => o.status !== "billed");

  return {
    ordersToday: allOrders.filter((o) => istDay(o.createdAt) === today).length,
    // Sales are recognised when the bill is paid in full.
    salesTodayRupees: bills
      .filter((b) => b.paidAt !== null && istDay(b.paidAt) === today)
      .reduce((sum, b) => sum + b.totalRupees, 0),
    occupiedTables: tables.filter((t) => t.status === "occupied").length,
    totalTables: tables.length,
    newOrders: active.filter((o) => o.status === "new").length,
    preparingOrders: active.filter((o) => o.status === "preparing").length,
    readyOrders: active.filter((o) => o.status === "ready").length,
    devicesOnline: devices.filter((d) => d.online).length,
    devicesTotal: devices.length,
  };
}

export async function getTopSellingItemsDb(
  restaurantId: string,
  limit = 5,
): Promise<ItemSalesSummary[]> {
  const [orders, menu] = await Promise.all([
    listAllOrders(restaurantId),
    getMenuIncludingArchivedDb(restaurantId),
  ]);
  const resolve = menuLookup(menu);
  const totals = new Map<string, ItemSalesSummary>();

  for (const order of orders) {
    for (const line of order.lines) {
      const revenue = line.qty * line.priceRupees;
      const key = line.itemId ?? line.code;
      const existing = totals.get(key);
      if (existing) {
        existing.qtySold += line.qty;
        existing.revenueRupees += revenue;
      } else {
        const item = resolve(line);
        totals.set(key, {
          code: item && item.archivedAt === null ? item.code : line.code,
          name: line.name,
          category: line.category ?? item?.category ?? "Other",
          qtySold: line.qty,
          revenueRupees: revenue,
        });
      }
    }
  }
  return Array.from(totals.values())
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, limit);
}

export async function getOrdersByCategoryDb(restaurantId: string): Promise<CategoryOrders[]> {
  const [orders, menu] = await Promise.all([
    listAllOrders(restaurantId),
    getMenuIncludingArchivedDb(restaurantId),
  ]);
  const resolve = menuLookup(menu);
  const totals = new Map<string, CategoryOrders>();

  for (const order of orders) {
    const seen = new Set<string>();
    for (const line of order.lines) {
      const category = line.category ?? resolve(line)?.category ?? "Other";
      seen.add(category);
      const existing = totals.get(category);
      if (existing) {
        existing.qty += line.qty;
        existing.revenueRupees += line.qty * line.priceRupees;
      } else {
        totals.set(category, {
          category,
          orders: 0,
          qty: line.qty,
          revenueRupees: line.qty * line.priceRupees,
        });
      }
    }
    for (const category of seen) {
      const entry = totals.get(category);
      if (entry) entry.orders += 1;
    }
  }
  return Array.from(totals.values()).sort((a, b) => b.orders - a.orders);
}

export async function getOrdersByHourWindowDb(
  restaurantId: string,
  hoursBack = 11,
  now = Date.now(),
): Promise<HourlyOrders[]> {
  const orders = await listAllOrders(restaurantId);
  const currentHour = istHour(now);
  const today = istDay(now);
  const yesterday = istDay(now - 24 * 60 * 60 * 1000);
  const buckets: (HourlyOrders & { day: string })[] = [];

  for (let i = hoursBack; i >= 0; i--) {
    const hour = (currentHour - i + 24) % 24;
    // Hours that wrapped past midnight belong to yesterday.
    const day = currentHour - i < 0 ? yesterday : today;
    buckets.push({ hour, day, hourLabel: formatHourLabel(hour), orders: 0, grossValueRupees: 0 });
  }

  for (const order of orders) {
    const hour = istHour(order.createdAt);
    const day = istDay(order.createdAt);
    const bucket = buckets.find((b) => b.hour === hour && b.day === day);
    if (bucket) {
      bucket.orders += 1;
      bucket.grossValueRupees += order.lines.reduce((s, l) => s + l.qty * l.priceRupees, 0);
    }
  }
  return buckets.map(({ day: _day, ...rest }) => rest);
}

export async function getSlowActiveOrdersDb(
  restaurantId: string,
  now = Date.now(),
): Promise<SlowOrder[]> {
  const [active, menu] = await Promise.all([
    listActiveOrders(restaurantId),
    getMenuIncludingArchivedDb(restaurantId),
  ]);
  const resolve = menuLookup(menu);
  const result: SlowOrder[] = [];

  for (const order of active) {
    if (order.status !== "new" && order.status !== "preparing") continue;
    const expectedMinutes = order.lines.reduce((max, line) => {
      const prep = line.prepMinutes ?? resolve(line)?.prepMinutes;
      return prep !== undefined ? Math.max(max, prep) : max;
    }, 0);
    const elapsedMinutes = (now - order.createdAt) / 60000;
    if (expectedMinutes > 0 && elapsedMinutes > expectedMinutes) {
      result.push({ order, expectedMinutes, elapsedMinutes });
    }
  }
  return result;
}

export type { Order };
