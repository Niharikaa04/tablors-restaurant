import Link from "next/link";

import { getDemoRole } from "@/server/modules/auth/session";
import {
  getBills,
  getOrders,
  getPayments,
  getRefunds,
  getTables,
} from "@/server/modules/demo-store/store";
import {
  PERIOD_LABELS,
  REPORT_PERIODS,
  TABLE_TIME_NOTE,
  buildSalesReport,
  parseReportPeriod,
} from "@/server/modules/reports/reports";

export const dynamic = "force-dynamic";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const card =
  "rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-2xl text-[var(--color-radium-500)]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-sm text-[var(--color-text-muted)]">{children}</p>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm text-[var(--color-text-muted)]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const th = "py-2 pr-4 text-left text-xs font-normal text-[var(--color-text-muted)]";
const td = "py-2 pr-4 text-sm text-[var(--color-text-secondary)]";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  // Financial data: enforce on the server, not just by hiding the nav link.
  const role = await getDemoRole();
  if (role !== "owner") {
    return (
      <div>
        <h1 className="text-2xl text-[var(--color-text-primary)]">Reports</h1>
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Reports are available to the restaurant owner only.
        </p>
      </div>
    );
  }

  const period = parseReportPeriod((await searchParams).period);
  const r = buildSalesReport(
    {
      orders: getOrders(),
      bills: getBills(),
      payments: getPayments(),
      refunds: getRefunds(),
      tables: getTables(),
    },
    period
  );
  const o = r.overview;
  const maxHour = Math.max(1, ...r.hourly.map((h) => h.orders));
  const firstHour = r.hourly.findIndex((h) => h.orders > 0);
  const lastHour = r.hourly.map((h) => h.orders > 0).lastIndexOf(true);
  const shownHours = firstHour === -1 ? [] : r.hourly.slice(firstHour, lastHour + 1);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl text-[var(--color-text-primary)]">Reports</h1>
        <nav aria-label="Report period" className="flex gap-1">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/owner/reports?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={
                p === period
                  ? "rounded-md bg-[var(--color-radium-500)] px-3 py-1.5 text-sm text-black"
                  : "rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Total sales (billed, incl. tax)" value={rupees(o.totalSalesRupees)} hint={`${o.billedOrders} billed`} />
        <Kpi
          label="Total collected (net)"
          value={rupees(o.netCollectedRupees)}
          hint={o.refundedRupees > 0 ? `${rupees(o.refundedRupees)} refunded` : undefined}
        />
        <Kpi label="Orders" value={String(o.orderCount)} />
        <Kpi label="Average order value" value={rupees(o.averageOrderValueRupees)} hint="Before tax & charges" />
        <Kpi label="Cancelled orders" value="N/A" hint="Not tracked yet" />
      </div>

      <Section title="Collected by payment method">
        <div className="grid gap-4 sm:grid-cols-3">
          {(["cash", "upi", "card"] as const).map((m) => (
            <div key={m} className={card}>
              <p className="text-xs uppercase text-[var(--color-text-muted)]">{m}</p>
              <p className="mt-2 text-xl text-[var(--color-text-primary)]">
                {rupees(o.collectedByMethod[m])}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Popular items">
        {r.popularItems.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Item</th>
                <th className={th}>Qty sold</th>
                <th className={th}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {r.popularItems.map((i, idx) => (
                <tr key={i.key} className="border-t border-[var(--color-border)]">
                  <td className={td}>{idx + 1}. {i.name}</td>
                  <td className={td}>{i.qtySold}</td>
                  <td className={td}>{rupees(i.revenueRupees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title={
          r.busiestHour
            ? `Peak ordering time — busiest hour: ${r.busiestHour.label} (${r.busiestHour.orders} orders)`
            : "Peak ordering time"
        }
      >
        {shownHours.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Orders per hour">
            {shownHours.map((h) => (
              <div key={h.hour} className="flex h-full flex-1 flex-col justify-end text-center">
                <span className="text-[10px] text-[var(--color-text-muted)]">{h.orders || ""}</span>
                <div
                  className={
                    r.busiestHour?.hour === h.hour
                      ? "bg-[var(--color-radium-500)]"
                      : "bg-[var(--color-text-muted)]/40"
                  }
                  style={{ height: `${(h.orders / maxHour) * 100}%`, minHeight: h.orders ? 2 : 0 }}
                />
                <span className="mt-1 text-[10px] text-[var(--color-text-muted)]">{h.label}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Sales by category">
        {r.categories.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Category</th>
                <th className={th}>Orders</th>
                <th className={th}>Items sold</th>
                <th className={th}>Revenue</th>
                <th className={th}>Share</th>
              </tr>
            </thead>
            <tbody>
              {r.categories.map((c) => (
                <tr key={c.category} className="border-t border-[var(--color-border)]">
                  <td className={td}>{c.category}</td>
                  <td className={td}>{c.orders}</td>
                  <td className={td}>{c.qtySold}</td>
                  <td className={td}>{rupees(c.revenueRupees)}</td>
                  <td className={td}>
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 bg-[var(--color-border)]">
                        <span
                          className="block h-full bg-[var(--color-radium-500)]"
                          style={{ width: `${c.sharePercent}%` }}
                        />
                      </span>
                      {c.sharePercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Sales by table">
        {r.tables.length === 0 ? (
          <Empty>No orders in this period.</Empty>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Table</th>
                <th className={th}>Orders</th>
                <th className={th}>Revenue</th>
                <th className={th}>Avg order value</th>
              </tr>
            </thead>
            <tbody>
              {r.tables.map((t) => (
                <tr key={t.tableId} className="border-t border-[var(--color-border)]">
                  <td className={td}>{t.label}</td>
                  <td className={td}>{t.orders}</td>
                  <td className={td}>{rupees(t.revenueRupees)}</td>
                  <td className={td}>{rupees(t.averageOrderValueRupees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm text-[var(--color-text-muted)]">Average table time</h2>
          {r.tableTime.available ? (
            <>
              <p className="mt-3 text-2xl text-[var(--color-radium-500)]">
                {r.tableTime.averageMinutes} min
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {r.tableTime.sampleSize} settled bill{r.tableTime.sampleSize === 1 ? "" : "s"}. {TABLE_TIME_NOTE}
              </p>
            </>
          ) : (
            <Empty>{r.tableTime.reason}</Empty>
          )}
        </section>
        <section>
          <h2 className="text-sm text-[var(--color-text-muted)]">Cancelled orders</h2>
          <Empty>{r.cancelled.reason}</Empty>
        </section>
      </div>
    </div>
  );
}