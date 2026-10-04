import Link from "next/link";
import {
  IndianRupee,
  ShoppingBag,
  Wallet,
  Grid,
  Clock,
  ChefHat,
  CheckCircle2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { getOrdersByHourWindow, getTodayOverview } from "@/server/modules/demo-store/store";

type Overview = ReturnType<typeof getTodayOverview>;
type HourlySeries = ReturnType<typeof getOrdersByHourWindow>;

type Metric = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub: string;
  href: string;
  valueClassName?: string;
  subClassName?: string;
  visual?: "sparkline-orders" | "sparkline-sales" | "progress";
  progressPercent?: number;
};

/** Tiny inline sparkline built straight from real hourly buckets — no chart library, no invented history. */
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const width = 100;
  const height = 28;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const points = values
    .map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-7 w-full">
      <polyline
        points={points}
        fill="none"
        stroke="var(--ov-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ov-border)]">
      <div
        className="h-full rounded-full bg-[var(--ov-accent)] transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function MetricStrip({
  overview,
  averageOrderValueRupees,
  hourlySeries,
}: {
  overview: Overview;
  averageOrderValueRupees: number;
  hourlySeries: HourlySeries;
}) {
  const freeTables = overview.totalTables - overview.occupiedTables;
  const devicesOffline = overview.devicesTotal - overview.devicesOnline;
  const occupancyPercent = overview.totalTables > 0 ? (overview.occupiedTables / overview.totalTables) * 100 : 0;
  const devicesPercent = overview.devicesTotal > 0 ? (overview.devicesOnline / overview.devicesTotal) * 100 : 0;

  const ordersSeries = hourlySeries.map((h) => h.orders);
  const salesSeries = hourlySeries.map((h) => h.grossValueRupees);

  const metrics: Metric[] = [
    {
      label: "Today's sales",
      value: `₹${overview.salesTodayRupees.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      sub: overview.salesTodayRupees > 0 ? "from billed orders" : "No bills settled yet",
      valueClassName: "text-[var(--ov-accent)]",
      href: "/owner/reports",
      visual: "sparkline-sales",
    },
    {
      label: "Total orders",
      value: overview.ordersToday,
      icon: ShoppingBag,
      sub: "current period",
      href: "/owner/orders",
      visual: "sparkline-orders",
    },
    {
      label: "Avg order value",
      value: `₹${averageOrderValueRupees.toLocaleString("en-IN")}`,
      icon: Wallet,
      sub: overview.ordersToday > 0 ? "per order today" : "No orders yet",
      href: "/owner/reports",
    },
    {
      label: "Table occupancy",
      value: `${overview.occupiedTables}/${overview.totalTables}`,
      icon: Grid,
      sub: `${freeTables} free · ${Math.round(occupancyPercent)}% occupied`,
      href: "/owner/tables",
      visual: "progress",
      progressPercent: occupancyPercent,
    },
    {
      label: "New orders",
      value: overview.newOrders,
      icon: Clock,
      sub: overview.newOrders > 0 ? "awaiting acceptance" : "all caught up",
      valueClassName: overview.newOrders > 0 ? "text-[var(--ov-gold)]" : undefined,
      href: "/kitchen",
    },
    {
      label: "Preparing",
      value: overview.preparingOrders,
      icon: ChefHat,
      sub: "in the kitchen",
      href: "/kitchen",
    },
    {
      label: "Ready",
      value: overview.readyOrders,
      icon: CheckCircle2,
      sub: overview.readyOrders > 0 ? "ready to serve" : "none waiting",
      valueClassName: overview.readyOrders > 0 ? "text-[var(--ov-accent)]" : undefined,
      href: "/owner/orders",
    },
    {
      label: "Devices online",
      value: `${overview.devicesOnline}/${overview.devicesTotal}`,
      icon: Smartphone,
      sub: devicesOffline > 0 ? `${devicesOffline} offline` : "all online",
      subClassName: devicesOffline > 0 ? "text-[var(--ov-gold)]" : undefined,
      href: "/owner/devices",
      visual: "progress",
      progressPercent: devicesPercent,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--ov-border)] bg-[var(--ov-border)] sm:grid-cols-4 xl:grid-cols-8">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Link
            key={metric.label}
            href={metric.href}
            className="group bg-[var(--ov-surface)] p-4 transition-colors hover:bg-[var(--ov-icon-surface)]"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--ov-muted)]">
              <Icon className="h-3 w-3" />
              {metric.label}
            </div>
            <p className={`mt-2 text-xl font-bold sm:text-2xl ${metric.valueClassName ?? "text-[var(--ov-text)]"}`}>
              {metric.value}
            </p>
            <p className={`mt-0.5 text-[11px] ${metric.subClassName ?? "text-[var(--ov-text-secondary)]"}`}>
              {metric.sub}
            </p>

            {metric.visual === "sparkline-orders" && <Sparkline values={ordersSeries} />}
            {metric.visual === "sparkline-sales" && <Sparkline values={salesSeries} />}
            {metric.visual === "progress" && <ProgressBar percent={metric.progressPercent ?? 0} />}
          </Link>
        );
      })}
    </div>
  );
}
