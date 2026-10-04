import Link from "next/link";
import { redirect } from "next/navigation";

import { getDemoRole } from "@/server/modules/auth/session";
import {
  BILL_LIMITS,
  DEFAULT_GST_PERCENT,
  getBillPaymentSummary,
  getBills,
  getOrders,
  getTables,
} from "@/server/modules/demo-store/store";
import { createBill } from "@/server/modules/billing/actions";

// Orders and bills live in server memory — never prerender.
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string; bill?: string; tableId?: string }>;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

function getNotice(code: string | undefined): Notice | null {
  switch (code) {
    case "billed":
      return {
        tone: "success",
        text: "Bill generated. The table stays occupied until the bill is fully paid.",
      };
    case "duplicate":
      return {
        tone: "error",
        text: "This order already has a bill. No second bill was created.",
      };
    case "not-served":
      return {
        tone: "error",
        text: "Only served orders can be billed. Mark the order Served in Live orders first.",
      };
    case "missing":
      return { tone: "error", text: "That order no longer exists." };
    case "table-missing":
      return { tone: "error", text: "That order's table no longer exists." };
    case "empty":
      return { tone: "error", text: "This order has no billable amount." };
    case "invalid-gst":
      return {
        tone: "error",
        text: `GST must be a number from 0 to ${BILL_LIMITS.gstMaxPercent}.`,
      };
    case "invalid-service-charge":
      return {
        tone: "error",
        text: `Service charge must be a number from 0 to ${BILL_LIMITS.serviceChargeMaxPercent}.`,
      };
    case "invalid-discount":
      return {
        tone: "error",
        text: "Discount must be a whole number of rupees, 0 or more.",
      };
    case "discount-too-large":
      return {
        tone: "error",
        text: "Discount is larger than the bill amount.",
      };
    case "invalid":
      return { tone: "error", text: "That request was invalid." };
    case "forbidden":
      return {
        tone: "error",
        text: "Only the restaurant owner can generate bills.",
      };
    default:
      return null;
  }
}

function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        className: "border-[var(--color-success)] text-[var(--color-success)]",
      };
    case "partial":
      return {
        label: "Partially paid",
        className: "border-[var(--color-gold-500)] text-[var(--color-gold-500)]",
      };
    case "refunded":
      return {
        label: "Refunded",
        className: "border-[var(--color-border)] text-[var(--color-text-muted)]",
      };
    default:
      return {
        label: "Unpaid",
        className: "border-[var(--color-warning)] text-[var(--color-warning)]",
      };
  }
}

export default async function BillingPage({ searchParams }: PageProps) {
  const role = await getDemoRole();

  if (role !== "owner" && role !== "admin") {
    redirect("/login");
  }

  // Only the owner may change anything; admin gets a read-only view.
  const canManage = role === "owner";

  const { notice, bill: noticeBillId, tableId } = await searchParams;

  const tables = getTables();
  const bills = getBills();

  const filterTable = tableId
    ? tables.find((t) => t.id === tableId) ?? null
    : null;

  // Only orders the owner has marked "Served" can be billed. Orders that
  // already have a bill are "billed", so they never appear here twice.
  const billableOrders = getOrders().filter(
    (o) =>
      o.status === "served" && (filterTable ? o.tableId === filterTable.id : true)
  );

  const noticeData = getNotice(typeof notice === "string" ? notice : undefined);
  const noticeBill = noticeBillId
    ? bills.find((b) => b.id === noticeBillId) ?? null
    : null;

  return (
    <div>
      <h1 className="text-2xl text-[var(--color-text-primary)]">Billing</h1>

      {!canManage && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          View only. Only the restaurant owner can generate bills or record payments.
        </p>
      )}

      {noticeData && (
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-brand)] border px-4 py-3 ${
            noticeData.tone === "success"
              ? "border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
          }`}
        >
          <p className="text-sm">{noticeData.text}</p>

          <div className="flex items-center gap-2">
            {noticeBill && (
              <Link
                href={`/owner/billing/${noticeBill.id}`}
                className="rounded-[var(--radius-brand)] border border-current px-3 py-1.5 text-xs font-medium"
              >
                View bill →
              </Link>
            )}

            {noticeBill && canManage && (
              <Link
                href={`/owner/payments#bill-${noticeBill.id}`}
                className="rounded-[var(--radius-brand)] border border-current px-3 py-1.5 text-xs font-medium"
              >
                Take payment →
              </Link>
            )}

            <Link
              href="/owner/billing"
              className="rounded-[var(--radius-brand)] border border-current px-3 py-1.5 text-xs font-medium"
            >
              Dismiss
            </Link>
          </div>
        </div>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-[var(--color-text-muted)]">
            Ready to bill
            {filterTable ? ` — ${filterTable.label}` : ""}
          </h2>

          {filterTable && (
            <Link
              href="/owner/billing"
              className="text-xs text-[var(--color-gold-500)]"
            >
              Show all tables
            </Link>
          )}
        </div>

        <div className="mt-3 space-y-4">
          {billableOrders.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              {filterTable
                ? `No served orders to bill for ${filterTable.label}. Mark the order "Served" from Live orders first.`
                : `No orders are ready to bill yet — mark an order "Served" from Live orders first.`}
            </p>
          )}

          {billableOrders.map((order) => {
            const table = tables.find((t) => t.id === order.tableId);
            const subtotal = order.lines.reduce(
              (sum, l) => sum + l.qty * l.priceRupees,
              0
            );

            return (
              <form
                key={order.id}
                action={createBill.bind(null, order.id)}
                className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base text-[var(--color-text-primary)]">
                      {table?.label ?? order.tableId}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Order #{order.id}
                    </p>
                  </div>

                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Subtotal {formatRupees(subtotal)}
                  </p>
                </div>

                <ul className="mt-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                  {order.lines.map((line) => (
                    <li key={`${order.id}-${line.code}`}>
                      {line.name} × {line.qty} — {formatRupees(line.qty * line.priceRupees)}
                    </li>
                  ))}
                </ul>

                {canManage ? (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[var(--color-text-secondary)] sm:grid-cols-3">
                      <label className="block">
                        GST %
                        <input
                          type="number"
                          name="gstPercent"
                          defaultValue={DEFAULT_GST_PERCENT}
                          min={0}
                          max={BILL_LIMITS.gstMaxPercent}
                          step={0.5}
                          required
                          className="mt-1 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-1.5 text-[var(--color-text-primary)]"
                        />
                      </label>

                      <label className="block">
                        Service charge %
                        <input
                          type="number"
                          name="serviceChargePercent"
                          defaultValue={0}
                          min={0}
                          max={BILL_LIMITS.serviceChargeMaxPercent}
                          step={0.5}
                          required
                          className="mt-1 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-1.5 text-[var(--color-text-primary)]"
                        />
                      </label>

                      <label className="block">
                        Discount ₹ (whole rupees)
                        <input
                          type="number"
                          name="discountRupees"
                          defaultValue={0}
                          min={0}
                          step={1}
                          required
                          className="mt-1 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-1.5 text-[var(--color-text-primary)]"
                        />
                      </label>
                    </div>

                    <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                      GST, service charge and the final total are calculated by
                      the server when you generate the bill.
                    </p>

                    <button
                      type="submit"
                      className="mt-3 rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-4 py-2 text-xs font-medium text-[#0a0a0a]"
                    >
                      Generate bill
                    </button>
                  </>
                ) : null}
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm text-[var(--color-text-muted)]">Bills</h2>

        <div className="mt-3 overflow-x-auto rounded-[var(--radius-brand)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-normal">Order</th>
                <th className="px-4 py-3 font-normal">Table</th>
                <th className="px-4 py-3 font-normal">Subtotal</th>
                <th className="px-4 py-3 font-normal">GST</th>
                <th className="px-4 py-3 font-normal">Service</th>
                <th className="px-4 py-3 font-normal">Discount</th>
                <th className="px-4 py-3 font-normal">Total</th>
                <th className="px-4 py-3 font-normal">Payment</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>

            <tbody>
              {bills.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-4 text-[var(--color-text-muted)]"
                  >
                    No bills generated yet.
                  </td>
                </tr>
              )}

              {bills
                .slice()
                .reverse()
                .map((bill) => {
                  const table = tables.find((t) => t.id === bill.tableId);
                  const summary = getBillPaymentSummary(bill);
                  const badge = statusBadge(summary.status);
                  const outstanding =
                    summary.status === "unpaid" || summary.status === "partial";

                  return (
                    <tr
                      key={bill.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        #{bill.orderId}
                      </td>

                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {table?.label ?? bill.tableId}
                      </td>

                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatRupees(bill.subtotalRupees)}
                      </td>

                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatRupees(bill.gstRupees)}
                      </td>

                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {formatRupees(bill.serviceChargeRupees)}
                      </td>

                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {bill.discountRupees > 0
                          ? `−${formatRupees(bill.discountRupees)}`
                          : formatRupees(0)}
                      </td>

                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                        {formatRupees(bill.totalRupees)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          Paid {formatRupees(summary.paidRupees)}
                          {outstanding
                            ? ` · Balance ${formatRupees(summary.remainingRupees)}`
                            : ""}
                          {summary.refundedRupees > 0
                            ? ` · Refunded ${formatRupees(summary.refundedRupees)}`
                            : ""}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {outstanding && canManage && (
                            <Link
                              href={`/owner/payments#bill-${bill.id}`}
                              className="rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-2.5 py-1 text-xs font-medium text-[#0a0a0a]"
                            >
                              Take payment
                            </Link>
                          )}

                          <Link
                            href={`/owner/billing/${bill.id}`}
                            className="rounded-[var(--radius-brand)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] hover:border-[var(--color-gold-500)]"
                          >
                            View / Print
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}