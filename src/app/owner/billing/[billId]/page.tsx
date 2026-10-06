import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrintBillButton } from "@/components/billing/print-bill-button";
import { getDemoRole } from "@/server/modules/auth/session";
import {
  getBills,
  getOrder,
  getTableById,
  getBillPaymentSummary,
} from "@/server/modules/demo-store/store";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ billId: string }>;
};

function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function methodLabel(method: string): string {
  return method === "upi"
    ? "UPI"
    : method.charAt(0).toUpperCase() + method.slice(1);
}

export default async function BillReceiptPage({ params }: PageProps) {
  const role = await getDemoRole();

  if (role !== "owner" && role !== "admin") {
    redirect("/login");
  }

  const { billId } = await params;

  const bill = getBills().find((b) => b.id === billId);

  if (!bill) {
    notFound();
  }

  const order = getOrder(bill.orderId);
  const table = getTableById(bill.tableId);
  const lines = order?.lines ?? [];
  const summary = getBillPaymentSummary(bill);

  return (
    <div>
      {/* Hide the app chrome when printing so only the receipt prints. */}
      <style>{`
        @media print {
          aside,
          nav,
          header,
          .no-print {
            display: none !important;
          }

          body {
            background: #ffffff !important;
          }
        }
      `}</style>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/owner/billing"
          className="text-sm text-[var(--color-text-muted)] transition hover:text-[var(--color-text-primary)]"
        >
          ← Back to billing
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <PrintBillButton />

          <button
            type="button"
            disabled
            title="Sending bills by email or WhatsApp is not available yet."
            className="cursor-not-allowed rounded-[var(--radius-brand)] border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] opacity-60"
          >
            Send digitally · Coming soon
          </button>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md rounded-[var(--radius-brand)] bg-white p-6 text-black">
        <div className="text-center">
          <p className="text-lg font-semibold">Tablor</p>
          <p className="text-xs text-neutral-600">Bill #{bill.id}</p>
        </div>

        <div className="mt-4 space-y-1 border-y border-dashed border-neutral-400 py-3 text-xs">
          <div className="flex justify-between">
            <span>Table</span>
            <span>{table?.label ?? bill.tableId}</span>
          </div>

          <div className="flex justify-between">
            <span>Order</span>
            <span>#{bill.orderId}</span>
          </div>

          {order && (
            <div className="flex justify-between">
              <span>Order placed</span>
              <span>{formatDateTime(order.createdAt)}</span>
            </div>
          )}

          {order && (
            <div className="flex justify-between">
              <span>Billed</span>
              <span>{formatDateTime(order.statusUpdatedAt)}</span>
            </div>
          )}
        </div>

        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-600">
              <th className="py-1 font-normal">Item</th>
              <th className="py-1 text-right font-normal">Qty</th>
              <th className="py-1 text-right font-normal">Price</th>
              <th className="py-1 text-right font-normal">Amount</th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line) => (
              <tr key={`${bill.id}-${line.code}`}>
                <td className="py-1">{line.name}</td>
                <td className="py-1 text-right">{line.qty}</td>
                <td className="py-1 text-right">
                  {formatRupees(line.priceRupees)}
                </td>
                <td className="py-1 text-right">
                  {formatRupees(line.qty * line.priceRupees)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 border-t border-dashed border-neutral-400 pt-3 text-xs">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatRupees(bill.subtotalRupees)}</span>
          </div>

          <div className="flex justify-between">
            <span>GST</span>
            <span>{formatRupees(bill.gstRupees)}</span>
          </div>

          <div className="flex justify-between">
            <span>Service charge</span>
            <span>{formatRupees(bill.serviceChargeRupees)}</span>
          </div>

          <div className="flex justify-between">
            <span>Discount</span>
            <span>
              {bill.discountRupees > 0
                ? `−${formatRupees(bill.discountRupees)}`
                : formatRupees(0)}
            </span>
          </div>

          <div className="flex justify-between border-t border-neutral-400 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{formatRupees(bill.totalRupees)}</span>
          </div>
        </div>

        {/* Payment status */}
        <div className="mt-4 border-t border-dashed border-neutral-400 pt-3 text-center text-xs">
          {summary.status === "unpaid" && (
            <p className="font-semibold">UNPAID</p>
          )}

          {summary.status === "partial" && (
            <div>
              <p className="font-semibold">PARTIALLY PAID</p>

              <p className="mt-1">
                Paid {formatRupees(summary.paidRupees)} · Balance{" "}
                {formatRupees(summary.remainingRupees)}
              </p>
            </div>
          )}

          {summary.status === "paid" &&
            bill.paymentMethod !== null &&
            bill.paidAt !== null && (
              <p className="font-semibold">
                PAID · {methodLabel(bill.paymentMethod)} ·{" "}
                {formatDateTime(bill.paidAt)}
              </p>
            )}

          {summary.status === "refunded" && (
            <p className="font-semibold">REFUNDED</p>
          )}

          {summary.payments
            .filter((payment) => payment.amountRupees > 0)
            .map((payment) => (
              <p key={payment.id} className="mt-1 text-neutral-600">
                {methodLabel(payment.method)}{" "}
                {formatRupees(payment.amountRupees)}
                {payment.transactionId
                  ? ` · Ref ${payment.transactionId}`
                  : ""}
              </p>
            ))}

          {summary.refundedRupees > 0 && (
            <p className="mt-1">
              Refunded {formatRupees(summary.refundedRupees)}
            </p>
          )}

          <p className="mt-2 text-neutral-600">
            Thank you for dining with us.
          </p>
        </div>
      </div>
    </div>
  );
}