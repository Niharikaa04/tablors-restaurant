
import { randomUUID } from "node:crypto";
import { DayPicker } from "@/components/ui/day-picker";
import { istDay, resolveDay, todayIst, yesterdayIst } from "@/lib/day";
import { LiveRefresh } from "@/components/live/live-refresh";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitOnceButton } from "@/components/ui/submit-once-button";
import { getDemoRole } from "@/server/modules/auth/session";
import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import {
  getBillSummariesDb,
  getDailyCollectionDb,
  listBillsDb,
  listPaymentsDb,
  listRefundsDb,
} from "@/server/modules/billing/db-billing";
import { getTablesDb } from "@/server/modules/data/tables-db";
import {
  type PaymentStatus,
} from "@/server/modules/demo-store/store";
import {
  recordPaymentAction,
  refundPaymentAction,
} from "@/server/modules/payments/actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ notice?: string; bill?: string; date?: string }>;
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

function getNotice(code?: string): Notice | null {
  switch (code) {
    case "paid":
      return {
        tone: "success",
        text: "Payment recorded. The bill is fully paid.",
      };
    case "partial":
      return {
        tone: "success",
        text: "Part payment recorded. The table stays occupied until the balance is paid.",
      };
    case "refunded":
      return {
        tone: "success",
        text: "Refund recorded against the original payment.",
      };
    case "already-paid":
      return {
        tone: "error",
        text: "This bill is already fully paid. Nothing was recorded.",
      };
    case "overpayment":
      return {
        tone: "error",
        text: "That amount is more than the remaining balance.",
      };
    case "invalid-amount":
      return {
        tone: "error",
        text: "Enter a whole number of rupees, 1 or more.",
      };
    case "invalid-method":
      return {
        tone: "error",
        text: "Only cash and QR payments are accepted.",
      };
    case "missing-reference":
      return {
        tone: "error",
        text: "QR payments need a transaction ID / UTR.",
      };
    case "invalid-reference":
      return {
        tone: "error",
        text: "Enter a valid transaction ID (6–40 letters, digits, - _ / .).",
      };
    case "duplicate-reference":
      return {
        tone: "error",
        text: "That transaction ID has already been used. Nothing was recorded.",
      };
    case "missing-bill":
      return {
        tone: "error",
        text: "That bill no longer exists.",
      };
    case "table-missing":
      return {
        tone: "error",
        text: "That bill's order or table no longer exists.",
      };
    case "missing-payment":
      return {
        tone: "error",
        text: "That payment no longer exists.",
      };
    case "refund-invalid-amount":
      return {
        tone: "error",
        text: "Refund amount must be a whole number of rupees, 1 or more.",
      };
    case "refund-invalid-reason":
      return {
        tone: "error",
        text: "Enter a refund reason of 3 to 200 characters.",
      };
    case "refund-exceeds":
      return {
        tone: "error",
        text: "Refund amount exceeds the refundable balance.",
      };
    case "forbidden":
      return {
        tone: "error",
        text: "Only the restaurant owner can record payments or refunds.",
      };
    case "invalid":
      return {
        tone: "error",
        text: "That request was invalid.",
      };
    default:
      return null;
  }
}

function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodLabel(method: string): string {
  if (method === "qr") return "qr";
  if (method === "cash") return "Cash";
  return method.charAt(0).toUpperCase() + method.slice(1);
}

function statusBadge(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        className:
          "border-[var(--color-success)] text-[var(--color-success)]",
      };
    case "partial":
      return {
        label: "Partially paid",
        className:
          "border-[var(--color-gold-500)] text-[var(--color-gold-500)]",
      };
    case "refunded":
      return {
        label: "Refunded",
        className:
          "border-[var(--color-border)] text-[var(--color-text-muted)]",
      };
    default:
      return {
        label: "Unpaid",
        className:
          "border-[var(--color-warning)] text-[var(--color-warning)]",
      };
  }
}

const inputClass =
  "mt-1 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-3 py-2 text-[var(--color-text-primary)]";

const buttonClass =
  "rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-4 py-2 text-xs font-medium text-[#0a0a0a] transition-opacity hover:opacity-90";

export default async function PaymentsPage({
  searchParams,
}: PageProps) {
  const role = await getDemoRole();

  if (role !== "owner" && role !== "admin") {
    redirect("/login");
  }

  const canManage = role === "owner";
  const { notice, bill: noticeBillId, date } = await searchParams;
  const noticeData = getNotice(
    typeof notice === "string" ? notice : undefined,
  );

  // Independent queries run together; summaries need `bills`, so they follow.
  const [tables, bills, payments, refunds, collection] = await Promise.all([
    getTablesDb(DEMO_RESTAURANT_ID),
    listBillsDb(DEMO_RESTAURANT_ID),
    listPaymentsDb(DEMO_RESTAURANT_ID),
    listRefundsDb(DEMO_RESTAURANT_ID),
    getDailyCollectionDb(DEMO_RESTAURANT_ID),
  ]);
  const today = todayIst();
  const selectedDay = resolveDay(date);
  const dayPayments = payments.filter((p) => istDay(p.paidAt) === selectedDay);
  const summaries = await getBillSummariesDb(DEMO_RESTAURANT_ID, bills);
  const getBillPaymentSummary = (b: (typeof bills)[number]) => summaries.get(b.id)!;

  const outstanding = bills.filter((bill) => {
    const status = getBillPaymentSummary(bill).status;
    return status === "unpaid" || status === "partial";
  });

  const cashCollected = collection.byMethod.cash ?? 0;

  return (
    <div className="space-y-2">
      <LiveRefresh intervalMs={10000} />
      <h1 className="text-2xl text-[var(--color-text-primary)]">
        Payments
      </h1>

      {!canManage && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          View only. Only the restaurant owner can record payments or
          refunds.
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
            {noticeBillId &&
              bills.some((bill) => bill.id === noticeBillId) && (
                <Link
                  href={`/owner/billing/${noticeBillId}`}
                  className="rounded-[var(--radius-brand)] border border-current px-3 py-1.5 text-xs font-medium"
                >
                  View bill →
                </Link>
              )}

            <Link
              href="/owner/payments"
              className="rounded-[var(--radius-brand)] border border-current px-3 py-1.5 text-xs font-medium"
            >
              Dismiss
            </Link>
          </div>
        </div>
      )}

      {/* Daily collection */}
      <section className="mt-6">
        <h2 className="text-sm text-[var(--color-text-muted)]">
          Today&apos;s collection · {collection.dateKey}
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-brand)] border border-[var(--color-gold-500)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">
              Net collected
            </p>
            <p className="mt-2 text-2xl text-[var(--color-text-primary)]">
              {formatRupees(collection.netRupees)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {collection.paymentCount} payment
              {collection.paymentCount === 1 ? "" : "s"} · Gross{" "}
              {formatRupees(collection.grossRupees)}
            </p>
          </div>

          <div className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">
              Cash collected
            </p>
            <p className="mt-2 text-2xl text-[var(--color-text-primary)]">
              {formatRupees(cashCollected)}
            </p>
          </div>
        </div>

        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Collection includes payments actually recorded today. Part
          payments count only the amount paid. Refunds recorded today
          ({formatRupees(collection.refundedRupees)}) are subtracted from
          the net figure.
        </p>
      </section>

      {/* Outstanding bills */}
      <section className="mt-10">
        <h2 className="text-sm text-[var(--color-text-muted)]">
          Outstanding bills
        </h2>

        <div className="mt-3 space-y-4">
          {outstanding.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              No unpaid bills. Generate a bill from Billing once an order
              is served.
            </p>
          )}

          {outstanding
            .slice()
            .reverse()
            .map((bill) => {
              const summary = getBillPaymentSummary(bill);
              const badge = statusBadge(summary.status);
              const table = tables.find(
                (item) => item.id === bill.tableId,
              );

              return (
                <div
                  key={bill.id}
                  id={`bill-${bill.id}`}
                  className="scroll-mt-6 rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 target:border-[var(--color-gold-500)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base text-[var(--color-text-primary)]">
                        {table?.label ?? bill.tableId}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Order #{bill.orderId} · Bill #{bill.id}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Total
                      </p>
                      <p className="text-[var(--color-text-primary)]">
                        {formatRupees(summary.totalRupees)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Paid
                      </p>
                      <p className="text-[var(--color-text-primary)]">
                        {formatRupees(summary.paidRupees)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Remaining
                      </p>
                      <p className="text-[var(--color-gold-500)]">
                        {formatRupees(summary.remainingRupees)}
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <form
                      action={recordPaymentAction}
                      className="mt-4 space-y-3"
                    >
                      <input
                        type="hidden"
                        name="billId"
                        value={bill.id}
                      />

                      <label className="block text-xs text-[var(--color-text-secondary)]">
                        Amount ₹ (whole rupees)
                        <input
                          type="number"
                          name="amountRupees"
                          defaultValue={summary.remainingRupees}
                          min={1}
                          max={summary.remainingRupees}
                          step={1}
                          required
                          className={inputClass}
                        />
                      </label>

                      <input
                        type="hidden"
                        name="method"
                        value="cash"
                      />

                      {/* One key per rendered form: a repeated submit is a server-side no-op. */}
                      <input
                        type="hidden"
                        name="idempotencyKey"
                        value={randomUUID()}
                      />

                      <SubmitOnceButton
                        className={buttonClass}
                        pendingLabel="Recording payment…"
                      >
                        Pay by Cash
                      </SubmitOnceButton>

                      <p className="text-xs text-[var(--color-text-muted)]">
                        Enter less than the remaining amount for a part
                        payment. The table is released only when the bill
                        is fully paid.
                      </p>
                    </form>
                  )}

                  {canManage && (
                    <form
                      action={recordPaymentAction}
                      className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4"
                    >
                      <input type="hidden" name="billId" value={bill.id} />
                      <input type="hidden" name="method" value="qr" />
                      <input type="hidden" name="idempotencyKey" value={randomUUID()} />

                      <label className="block text-xs text-[var(--color-text-secondary)]">
                        Amount ₹ (whole rupees)
                        <input
                          type="number"
                          name="amountRupees"
                          defaultValue={summary.remainingRupees}
                          min={1}
                          max={summary.remainingRupees}
                          step={1}
                          required
                          className={inputClass}
                        />
                      </label>

                      <label className="block text-xs text-[var(--color-text-secondary)]">
                        QR transaction ID / UTR
                        <input
                          type="text"
                          name="transactionId"
                          minLength={6}
                          maxLength={40}
                          required
                          autoComplete="off"
                          className={inputClass}
                        />
                      </label>

                      <SubmitOnceButton
                        className={buttonClass}
                        pendingLabel="Recording payment…"
                      >
                        Record QR payment
                      </SubmitOnceButton>

                      <p className="text-xs text-[var(--color-text-muted)]">
                        Each transaction ID can be used only once.
                      </p>
                    </form>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* Payment history */}
      <section className="mt-10">
        <h2 className="text-sm text-[var(--color-text-muted)]">
          Payment history
        </h2>
        <DayPicker value={selectedDay} today={today} yesterday={yesterdayIst()} />

        <div className="mt-3 overflow-x-auto rounded-[var(--radius-brand)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-normal">Paid at</th>
                <th className="px-4 py-3 font-normal">Table</th>
                <th className="px-4 py-3 font-normal">Order</th>
                <th className="px-4 py-3 font-normal">Bill</th>
                <th className="px-4 py-3 font-normal">Method</th>
                <th className="px-4 py-3 font-normal">Transaction ID</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Refunded</th>
                <th className="px-4 py-3 font-normal">Bill status</th>
                <th className="px-4 py-3 font-normal" />
              </tr>
            </thead>

            <tbody>
              {dayPayments.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-4 text-[var(--color-text-muted)]"
                  >
                    {selectedDay === today ? "No payments recorded yet today." : "No payments on this day."}
                  </td>
                </tr>
              )}

              {dayPayments
                .slice()
                .reverse()
                .map((payment) => {
                  const bill = bills.find(
                    (item) => item.id === payment.billId,
                  );
                  const table = tables.find(
                    (item) => item.id === payment.tableId,
                  );
                  const refundedOnPayment = refunds
                    .filter((item) => item.paymentId === payment.id)
                    .reduce(
                      (sum, item) => sum + item.amountRupees,
                      0,
                    );
                  const refundable =
                    payment.amountRupees - refundedOnPayment;
                  const badge = statusBadge(
                    bill
                      ? getBillPaymentSummary(bill).status
                      : "unpaid",
                  );

                  return (
                    <tr
                      key={payment.id}
                      className="border-b border-[var(--color-border)] align-top last:border-0"
                    >
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        {formatDateTime(payment.paidAt)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {table?.label ?? payment.tableId}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)]">
                        #{payment.orderId}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/owner/billing/${payment.billId}`}
                          className="text-[var(--color-text-secondary)] underline-offset-2 hover:underline"
                        >
                          #{payment.billId}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {methodLabel(payment.method)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {payment.transactionId ?? "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                        {formatRupees(payment.amountRupees)}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {refundedOnPayment > 0
                          ? formatRupees(refundedOnPayment)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {canManage && refundable > 0 && (
                          <details>
                            <summary className="cursor-pointer list-none rounded-[var(--radius-brand)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] hover:border-[var(--color-gold-500)] [&::-webkit-details-marker]:hidden">
                              Refund
                            </summary>

                            <form
                              action={refundPaymentAction}
                              className="mt-2 w-56 space-y-2 text-xs text-[var(--color-text-secondary)]"
                            >
                              <input
                                type="hidden"
                                name="paymentId"
                                value={payment.id}
                              />

                              <label className="block">
                                Amount ₹ (max {formatRupees(refundable)})
                                <input
                                  type="number"
                                  name="amountRupees"
                                  defaultValue={refundable}
                                  min={1}
                                  max={refundable}
                                  step={1}
                                  required
                                  className={inputClass}
                                />
                              </label>

                              <label className="block">
                                Reason
                                <input
                                  type="text"
                                  name="reason"
                                  minLength={3}
                                  maxLength={200}
                                  required
                                  className={inputClass}
                                />
                              </label>

                              <SubmitOnceButton
                                className="w-full rounded-[var(--radius-brand)] bg-[var(--color-warning)] px-3 py-1.5 text-xs font-medium text-[#0a0a0a]"
                                pendingLabel="Refunding…"
                              >
                                Confirm refund
                              </SubmitOnceButton>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Refund history */}
      <section className="mt-10">
        <h2 className="text-sm text-[var(--color-text-muted)]">
          Refunds
        </h2>

        <div className="mt-3 overflow-x-auto rounded-[var(--radius-brand)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)] text-left text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-normal">Refunded at</th>
                <th className="px-4 py-3 font-normal">Payment</th>
                <th className="px-4 py-3 font-normal">Bill</th>
                <th className="px-4 py-3 font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Reason</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>

            <tbody>
              {refunds.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-4 text-[var(--color-text-muted)]"
                  >
                    No refunds recorded.
                  </td>
                </tr>
              )}

              {refunds
                .slice()
                .reverse()
                .map((refund) => (
                  <tr
                    key={refund.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-4 py-3 text-[var(--color-text-muted)]">
                      {formatDateTime(refund.refundedAt)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      #{refund.paymentId}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      #{refund.billId}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {formatRupees(refund.amountRupees)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {refund.reason}
                    </td>
                    <td className="px-4 py-3 capitalize text-[var(--color-text-secondary)]">
                      {refund.status}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Refunds are recorded against the original payment. Recording a
          refund here does not send money through a payment gateway.
        </p>
      </section>
    </div>
  );
}
