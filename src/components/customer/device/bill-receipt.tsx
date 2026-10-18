"use client";

import type { CustomerBillState } from "@/server/modules/customer/actions";

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const when = (ms: number) =>
  new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

const STATUS_LABEL = {
  paid: "PAID",
  partial: "PARTIALLY PAID",
  unpaid: "PAYMENT PENDING",
} as const;

const METHOD_LABEL = { cash: "Cash", qr: "QR" } as const;

/**
 * Itemised, printable bill. Every figure is read from the server-built
 * receipt (stored order items, bill totals and payments), never recomputed
 * from client state.  */
export function BillReceipt({ bill }: { bill: CustomerBillState }) {
  const receipt = bill.receipt;
  if (!receipt) return null;

  return (
    <div>
      <div
        className="rounded-xl border p-4 text-xs"
        style={{
          borderColor: "var(--device-shell-border)",
          background: "var(--device-lcd-bg)",
          color: "var(--device-lcd-text)",
        }}
      >
        <p className="text-center text-sm font-bold" style={{ color: "var(--device-gold)" }}>
          {bill.restaurantName}
        </p>
        <p className="mt-0.5 text-center" style={{ color: "var(--device-lcd-muted)" }}>
          Tax invoice / bill
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
          <dt style={{ color: "var(--device-lcd-muted)" }}>Bill no.</dt>
          <dd className="text-right font-semibold">#{receipt.billId}</dd>
          <dt style={{ color: "var(--device-lcd-muted)" }}>Order no.</dt>
          <dd className="text-right font-semibold">#{receipt.orderId}</dd>
          <dt style={{ color: "var(--device-lcd-muted)" }}>Table</dt>
          <dd className="text-right font-semibold">{receipt.tableLabel}</dd>
          <dt style={{ color: "var(--device-lcd-muted)" }}>Ordered</dt>
          <dd className="text-right">{when(receipt.orderPlacedAt)}</dd>
        </dl>

        <table className="mt-3 w-full">
          <thead>
            <tr style={{ color: "var(--device-lcd-muted)" }}>
              <th className="pb-1 text-left font-normal">Item</th>
              <th className="pb-1 text-right font-normal">Qty</th>
              <th className="pb-1 text-right font-normal">Rate</th>
              <th className="pb-1 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line, index) => (
              <tr
                key={`${line.code}-${index}`}
                className="border-t"
                style={{ borderColor: "var(--device-shell-border)" }}
              >
                <td className="py-1 pr-2">{line.name}</td>
                <td className="py-1 text-right">{line.qty}</td>
                <td className="py-1 text-right">{inr(line.unitRupees)}</td>
                <td className="py-1 text-right">{inr(line.lineRupees)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          className="mt-2 space-y-1 border-t pt-2"
          style={{ borderColor: "var(--device-shell-border)" }}
        >
          <Row label={`Subtotal (${receipt.itemCount} items)`} value={inr(receipt.subtotalRupees)} />
          {receipt.discountRupees > 0 && (
            <Row label="Discount" value={`− ${inr(receipt.discountRupees)}`} />
          )}
          {receipt.serviceChargeRupees > 0 && (
            <Row label="Service charge" value={inr(receipt.serviceChargeRupees)} />
          )}
          <Row label="GST" value={inr(receipt.gstRupees)} />
          <div className="flex items-center justify-between pt-1 text-sm font-bold">
            <span>Total</span>
            <span style={{ color: "var(--device-gold)" }}>{inr(receipt.totalRupees)}</span>
          </div>
        </div>

        <div
          className="mt-3 space-y-1 border-t pt-2"
          style={{ borderColor: "var(--device-shell-border)" }}
        >
          <Row label="Status" value={STATUS_LABEL[receipt.status]} />
          {receipt.paymentMethod && (
            <Row label="Payment method" value={METHOD_LABEL[receipt.paymentMethod]} />
          )}
          {receipt.paymentReference && (
            <Row label="Payment reference" value={receipt.paymentReference} />
          )}
          {receipt.paidAt !== null && <Row label="Paid on" value={when(receipt.paidAt)} />}
        </div>
      </div>

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--device-lcd-muted)" }}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
