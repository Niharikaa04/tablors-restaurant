"use client";

import { useState } from "react";
import type { CustomerBillState } from "@/server/modules/customer/actions";

function rupees(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function PaymentPanel({
  bill,
  mode = "bill",
  onClose,
  onGenerateBill,
  generatingBill,
  onConfirmUpi,
  confirmingUpi,
}: {
  bill: CustomerBillState | null;
  mode?: "bill" | "qr";
  onClose: () => void;
  onGenerateBill?: () => void;
  generatingBill?: boolean;
  onConfirmUpi?: (transactionId: string) => void;
  confirmingUpi?: boolean;
}) {
  const [transactionId, setTransactionId] = useState("");

  /*
   * No bill generated yet.
   */
  if (!bill) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div
          className="w-full max-w-md rounded-2xl border p-5"
          style={{
            background: "var(--device-shell)",
            borderColor: "var(--device-gold)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--device-gold)" }}
              >
                Bill & Payment
              </p>

              <p
                className="mt-1 text-xs"
                style={{ color: "var(--device-lcd-muted)" }}
              >
                Your bill has not been generated yet.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1 text-xs"
              style={{ color: "var(--device-lcd-text)" }}
            >
              Close
            </button>
          </div>

          <button
            type="button"
            onClick={onGenerateBill}
            disabled={generatingBill}
            className="mt-5 w-full rounded-md py-3 text-sm font-semibold disabled:opacity-50"
            style={{
              background: "var(--device-gold)",
              color: "#171a10",
            }}
          >
            {generatingBill ? "Generating…" : "Generate Bill"}
          </button>
        </div>
      </div>
    );
  }

  const paid = bill.status === "paid";
  const partial = bill.status === "partial";
  const hasBalance = bill.remainingRupees > 0;

  const upiAddress =
    bill.upiUri?.match(/(?:^|[?&])pa=([^&]+)/)?.[1] ?? null;

  /*
   * ============================================================
   * BILL MODE
   * ============================================================
   *
   * BILL GEN opens this view.
   * No QR is displayed here.
   */
  if (mode === "bill") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border p-5"
          style={{
            background: "var(--device-shell)",
            borderColor: "var(--device-gold)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--device-gold)" }}
              >
                BILL #{bill.billId}
              </p>

              <p
                className="mt-1 text-xs"
                style={{ color: "var(--device-lcd-muted)" }}
              >
                Restaurant Bill
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1 text-xs"
              style={{ color: "var(--device-lcd-text)" }}
            >
              Close
            </button>
          </div>

          <div
            className="mt-5 rounded-xl border p-4"
            style={{
              borderColor: "var(--device-shell-border)",
              background: "var(--device-lcd-bg)",
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{ color: "var(--device-lcd-muted)" }}
              >
                Bill Number
              </span>

              <span
                className="text-sm font-semibold"
                style={{ color: "var(--device-lcd-text)" }}
              >
                #{bill.billId}
              </span>
            </div>

            <div
              className="my-4 border-t"
              style={{ borderColor: "var(--device-shell-border)" }}
            />

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--device-lcd-muted)" }}>
                  Total Amount
                </span>

                <span
                  className="font-semibold"
                  style={{ color: "var(--device-lcd-text)" }}
                >
                  {rupees(bill.totalRupees)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ color: "var(--device-lcd-muted)" }}>
                  Paid
                </span>

                <span
                  className="font-semibold"
                  style={{ color: "var(--device-lcd-text)" }}
                >
                  {rupees(bill.paidRupees)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ color: "var(--device-lcd-muted)" }}>
                  Remaining
                </span>

                <span
                  className="font-bold"
                  style={{ color: "var(--device-gold)" }}
                >
                  {rupees(bill.remainingRupees)}
                </span>
              </div>
            </div>

            <div
              className="mt-4 rounded-lg border px-3 py-2 text-center text-xs font-semibold"
              style={{
                borderColor: "var(--device-shell-border)",
                color: paid
                  ? "var(--device-gold)"
                  : "var(--device-lcd-muted)",
              }}
            >
              {paid
                ? "PAID"
                : partial
                  ? "PARTIALLY PAID"
                  : "PAYMENT PENDING"}
            </div>
          </div>

          {paid && (
            <p
              className="mt-4 rounded-lg border px-4 py-3 text-center text-sm font-semibold"
              style={{
                borderColor: "var(--device-gold)",
                color: "var(--device-gold)",
              }}
            >
              Payment successful. Thank you for dining with us.
            </p>
          )}

          {!paid && hasBalance && (
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-md py-3 text-sm font-semibold"
              style={{
                background: "var(--device-gold)",
                color: "#171a10",
              }}
            >
              Close Bill
            </button>
          )}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * QR / PAYMENT MODE
   * ============================================================
   *
   * QR GEN opens this view.
   */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border p-5"
        style={{
          background: "var(--device-shell)",
          borderColor: "var(--device-gold)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--device-gold)" }}
            >
              PAY BILL #{bill.billId}
            </p>

            <p
              className="mt-1 text-xs"
              style={{ color: "var(--device-lcd-muted)" }}
            >
              {paid
                ? "Payment completed"
                : partial
                  ? "Partially paid"
                  : "Scan to pay"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-xs"
            style={{ color: "var(--device-lcd-text)" }}
          >
            Close
          </button>
        </div>

        {/* Amount */}
        <div
          className="mt-5 rounded-xl border p-4 text-center"
          style={{
            borderColor: "var(--device-shell-border)",
            background: "var(--device-lcd-bg)",
          }}
        >
          <p
            className="text-[11px] uppercase tracking-widest"
            style={{ color: "var(--device-lcd-muted)" }}
          >
            Amount to Pay
          </p>

          <p
            className="mt-1 text-3xl font-bold"
            style={{ color: "var(--device-gold)" }}
          >
            {rupees(bill.remainingRupees)}
          </p>
        </div>

        {paid ? (
          <div
            className="mt-5 rounded-lg border px-4 py-4 text-center"
            style={{
              borderColor: "var(--device-gold)",
              background: "var(--device-lcd-bg)",
            }}
          >
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--device-gold)" }}
            >
              Payment successful
            </p>

            <p
              className="mt-1 text-xs"
              style={{ color: "var(--device-lcd-muted)" }}
            >
              Thank you for dining with us.
            </p>
          </div>
        ) : !bill.upiConfigured ? (
          <div
            className="mt-5 rounded-lg border p-4 text-center"
            style={{
              borderColor: "var(--device-shell-border)",
              color: "var(--device-lcd-muted)",
            }}
          >
            <p className="text-sm font-semibold">
              UPI payment is not configured
            </p>

            <p className="mt-2 text-xs">
              This Tablor installation does not have a restaurant UPI
              account configured yet.
            </p>

            <p
              className="mt-3 text-[11px]"
              style={{ color: "var(--device-gold)" }}
            >
              Configure a restaurant UPI account before accepting real
              payments.
            </p>
          </div>
        ) : !hasBalance ? (
          <div
            className="mt-5 rounded-lg border p-4 text-center"
            style={{
              borderColor: "var(--device-gold)",
              color: "var(--device-gold)",
            }}
          >
            <p className="text-sm font-semibold">
              No payment remaining
            </p>
          </div>
        ) : (
          <>
            {/* QR */}
            <div
              className="mt-5 rounded-xl border p-4"
              style={{
                borderColor: "var(--device-shell-border)",
                background: "var(--device-lcd-bg)",
              }}
            >
              <div className="text-center">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--device-lcd-text)" }}
                >
                  Scan to Pay
                </p>

                <p
                  className="mt-1 text-xs"
                  style={{ color: "var(--device-lcd-muted)" }}
                >
                  Scan with GPay, PhonePe, Paytm or another supported
                  UPI app.
                </p>
              </div>

              {bill.qrUrl ? (
                <div className="mx-auto mt-4 flex h-60 w-60 items-center justify-center rounded-xl bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bill.qrUrl}
                    alt={`UPI payment QR code for ${rupees(
                      bill.remainingRupees
                    )}`}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="mx-auto mt-4 flex h-60 w-60 items-center justify-center rounded-xl border text-center"
                  style={{
                    borderColor: "var(--device-shell-border)",
                    background: "var(--device-shell)",
                  }}
                >
                  <div className="px-6">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--device-gold)" }}
                    >
                      QR unavailable
                    </p>

                    <p
                      className="mt-2 text-xs"
                      style={{ color: "var(--device-lcd-muted)" }}
                    >
                      A restaurant UPI account is required to generate
                      a real payment QR.
                    </p>
                  </div>
                </div>
              )}

              {upiAddress && (
                <p
                  className="mt-3 break-all text-center text-[11px]"
                  style={{ color: "var(--device-lcd-muted)" }}
                >
                  UPI ID: {upiAddress}
                </p>
              )}
            </div>

            {/* Open UPI app */}
            {bill.upiUri && (
              <a
                href={bill.upiUri}
                className="mt-3 block rounded-md py-3 text-center text-sm font-semibold"
                style={{
                  background: "var(--device-gold)",
                  color: "#171a10",
                }}
              >
                Open UPI App
              </a>
            )}

            {/* UTR */}
            <div className="mt-4">
              <label
                htmlFor="customer-upi-reference"
                className="text-xs"
                style={{ color: "var(--device-lcd-muted)" }}
              >
                UTR / Transaction ID
              </label>

              <input
                id="customer-upi-reference"
                value={transactionId}
                onChange={(event) =>
                  setTransactionId(event.target.value)
                }
                placeholder="Enter UTR / transaction reference"
                autoComplete="off"
                inputMode="text"
                maxLength={40}
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-3 text-sm outline-none"
                style={{
                  borderColor: "var(--device-shell-border)",
                  color: "var(--device-lcd-text)",
                }}
              />

              <p
                className="mt-1 text-[10px]"
                style={{ color: "var(--device-lcd-muted)" }}
              >
                6–40 characters: letters, numbers, -, _, / or .
              </p>
            </div>

            {/* Confirm */}
            <button
              type="button"
              onClick={() => onConfirmUpi?.(transactionId.trim())}
              disabled={
                confirmingUpi || transactionId.trim().length < 6
              }
              className="mt-3 w-full rounded-md py-3 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: "var(--device-gold)",
                color: "#171a10",
              }}
            >
              {confirmingUpi
                ? "Confirming Payment…"
                : "I Paid — Confirm UPI Payment"}
            </button>

            <p
              className="mt-3 text-center text-[11px]"
              style={{ color: "var(--device-lcd-muted)" }}
            >
              Enter the transaction reference only after completing
              the payment in your UPI app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}