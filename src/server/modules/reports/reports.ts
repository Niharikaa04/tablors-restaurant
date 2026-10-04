import type {
  Bill,
  Order,
  Payment,
  Refund,
  RestaurantTable,
} from "@/server/modules/demo-store/store";

/**
 * Pure report calculations. No store imports (types only), so every
 * function is deterministic and unit-testable with injected data.
 * All day/week/month boundaries are computed in IST (India has no DST,
 * so a fixed +05:30 offset is exact).
 */

export const REPORT_PERIODS = ["today", "yesterday", "week", "month"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This Week",
  month: "This Month",
};

/** The order model has no "cancelled" status, so we never fabricate one. */
export const CANCELLED_ORDERS_SUPPORTED = false;

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function parseReportPeriod(value: unknown): ReportPeriod {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (REPORT_PERIODS as readonly string[]).includes(v)
    ? (v as ReportPeriod)
    : "today";
}

function startOfDayIST(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
}

export type PeriodRange = { start: number; end: number }; // [start, end)

export function getPeriodRange(period: ReportPeriod, now: number): PeriodRange {
  const today = startOfDayIST(now);

  switch (period) {
    case "today":
      return { start: today, end: today + DAY_MS };
    case "yesterday":
      return { start: today - DAY_MS, end: today };
    case "week": {
      const dow = new Date(today + IST_OFFSET_MS).getUTCDay(); // 0 = Sun
      const start = today - ((dow + 6) % 7) * DAY_MS; // Monday
      return { start, end: start + 7 * DAY_MS };
    }
    case "month": {
      const d = new Date(today + IST_OFFSET_MS);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      return {
        start: Date.UTC(y, m, 1) - IST_OFFSET_MS,
        end: Date.UTC(y, m + 1, 1) - IST_OFFSET_MS,
      };
    }
  }
}

export type ReportData = {
  orders: readonly Order[];
  bills: readonly Bill[];
  payments: readonly Payment[];
  refunds: readonly Refund[];
  tables: readonly RestaurantTable[];
};

export type PopularItem = { key: string; name: string; qtySold: number; revenueRupees: number };
export type CategorySales = {
  category: string;
  orders: number;
  qtySold: number;
  revenueRupees: number;
  sharePercent: number;
};
export type TableSales = {
  tableId: string;
  label: string;
  orders: number;
  revenueRupees: number;
  averageOrderValueRupees: number;
};
export type HourBucket = { hour: number; label: string; orders: number };

export type SalesReport = {
  period: ReportPeriod;
  range: PeriodRange;
  overview: {
    totalSalesRupees: number;
    billedOrders: number;
    collectedRupees: number;
    refundedRupees: number;
    netCollectedRupees: number;
    collectedByMethod: { cash: number; upi: number; card: number };
    orderCount: number;
    orderValueRupees: number;
    averageOrderValueRupees: number;
  };
  popularItems: PopularItem[];
  categories: CategorySales[];
  tables: TableSales[];
  hourly: HourBucket[];
  busiestHour: HourBucket | null;
  cancelled: { supported: false; reason: string };
  tableTime:
    | { available: true; averageMinutes: number; sampleSize: number }
    | { available: false; reason: string };
};

export const CANCELLED_UNSUPPORTED_REASON =
  "Orders currently have no 'cancelled' status or cancelledAt timestamp, so cancellations can't be counted. Adding a cancel action that sets status 'cancelled' + cancelledAt would enable this report.";

export const TABLE_TIME_NOTE =
  "Measured from first order placed to bill fully paid. The system doesn't record when guests sit down or leave, so this is order-to-payment time, not true occupancy.";

function hourLabel(hour: number): string {
  const period = hour < 12 ? "AM" : "PM";
  return `${hour % 12 === 0 ? 12 : hour % 12} ${period}`;
}

function istHour(ms: number): number {
  return new Date(ms + IST_OFFSET_MS).getUTCHours();
}

const orderValue = (o: Order): number =>
  o.lines.reduce((sum, l) => sum + l.qty * l.priceRupees, 0);

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function buildSalesReport(
  data: ReportData,
  period: ReportPeriod,
  now: number = Date.now()
): SalesReport {
  const range = getPeriodRange(period, now);
  const orders = data.orders.filter((o) => o.createdAt >= range.start && o.createdAt < range.end);
  const orderIds = new Set(orders.map((o) => o.id));

  // ---- Sales: bills belonging to orders placed in the period ----
  const bills = data.bills.filter((b) => orderIds.has(b.orderId));
  const totalSalesRupees = bills.reduce((s, b) => s + b.totalRupees, 0);

  // ---- Collected: money actually received in the period ----
  const collectedByMethod = { cash: 0, upi: 0, card: 0 };
  for (const p of data.payments) {
    if (p.paidAt >= range.start && p.paidAt < range.end && p.amountRupees > 0) {
      collectedByMethod[p.method] += p.amountRupees;
    }
  }
  const collectedRupees = collectedByMethod.cash + collectedByMethod.upi + collectedByMethod.card;
  const refundedRupees = data.refunds
    .filter((r) => r.refundedAt >= range.start && r.refundedAt < range.end)
    .reduce((s, r) => s + r.amountRupees, 0);

  // ---- Single pass over lines for items / categories / tables / hours ----
  const items = new Map<string, PopularItem>();
  const cats = new Map<string, CategorySales>();
  const tableTotals = new Map<string, { orders: number; revenue: number }>();
  const hourly: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: hourLabel(h),
    orders: 0,
  }));
  let orderValueRupees = 0;

  for (const order of orders) {
    const value = orderValue(order);
    orderValueRupees += value;
    hourly[istHour(order.createdAt)].orders += 1;

    const t = tableTotals.get(order.tableId) ?? { orders: 0, revenue: 0 };
    t.orders += 1;
    t.revenue += value;
    tableTotals.set(order.tableId, t);

    const seenCats = new Set<string>();
    for (const line of order.lines) {
      const revenue = line.qty * line.priceRupees;
      const key = line.itemId ?? line.code;
      const item = items.get(key);
      if (item) {
        item.qtySold += line.qty;
        item.revenueRupees += revenue;
      } else {
        items.set(key, { key, name: line.name, qtySold: line.qty, revenueRupees: revenue });
      }

      const category = line.category ?? "Other";
      let c = cats.get(category);
      if (!c) {
        c = { category, orders: 0, qtySold: 0, revenueRupees: 0, sharePercent: 0 };
        cats.set(category, c);
      }
      c.qtySold += line.qty;
      c.revenueRupees += revenue;
      seenCats.add(category);
    }
    for (const category of seenCats) cats.get(category)!.orders += 1;
  }

  const popularItems = [...items.values()]
    .sort((a, b) => b.qtySold - a.qtySold || b.revenueRupees - a.revenueRupees || a.name.localeCompare(b.name))
    .slice(0, 10);

  const categories = [...cats.values()]
    .map((c) => ({
      ...c,
      sharePercent: orderValueRupees > 0 ? round1((c.revenueRupees / orderValueRupees) * 100) : 0,
    }))
    .sort((a, b) => b.revenueRupees - a.revenueRupees);

  const labels = new Map(data.tables.map((t) => [t.id, t.label]));
  const tables = [...tableTotals.entries()]
    .map(([tableId, t]) => ({
      tableId,
      label: labels.get(tableId) ?? tableId,
      orders: t.orders,
      revenueRupees: t.revenue,
      averageOrderValueRupees: Math.round(t.revenue / t.orders),
    }))
    .sort((a, b) => b.revenueRupees - a.revenueRupees);

  const busiest = hourly.reduce((best, b) => (b.orders > best.orders ? b : best), hourly[0]);

  // ---- Table time: order placed -> bill settled ----
  const billByOrder = new Map(data.bills.map((b) => [b.orderId, b]));
  const durations: number[] = [];
  for (const order of orders) {
    const bill = billByOrder.get(order.id);
    if (bill && bill.paidAt !== null && bill.paidAt >= order.createdAt) {
      durations.push((bill.paidAt - order.createdAt) / 60000);
    }
  }

  return {
    period,
    range,
    overview: {
      totalSalesRupees,
      billedOrders: bills.length,
      collectedRupees,
      refundedRupees,
      netCollectedRupees: collectedRupees - refundedRupees,
      collectedByMethod,
      orderCount: orders.length,
      orderValueRupees,
      averageOrderValueRupees: orders.length ? Math.round(orderValueRupees / orders.length) : 0,
    },
    popularItems,
    categories,
    tables,
    hourly,
    busiestHour: busiest.orders > 0 ? busiest : null,
    cancelled: { supported: false, reason: CANCELLED_UNSUPPORTED_REASON },
    tableTime: durations.length
      ? {
          available: true,
          averageMinutes: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          sampleSize: durations.length,
        }
      : {
          available: false,
          reason: `No settled bills in this period yet. ${TABLE_TIME_NOTE}`,
        },
  };
}