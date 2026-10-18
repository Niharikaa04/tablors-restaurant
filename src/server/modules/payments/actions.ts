"use server";

import { revalidatePath } from "next/cache";
import { reverseLoyaltyForRefundDb } from "@/server/modules/loyalty-db/db-loyalty";
import { redirect } from "next/navigation";

import {
  DEMO_RESTAURANT_ID,
  getDemoRole,
} from "@/server/modules/auth/session";
import {
  recordBillPaymentDb,
  refundPaymentDb,
} from "@/server/modules/billing/db-billing";
import { notify } from "@/server/modules/notifications/store";
import {
  onBillPaymentConfirmed,
  onPaymentRefunded,
} from "@/server/modules/financial-pots/payment-hook";

async function isOwner(): Promise<boolean> {
  return (await getDemoRole()) === "owner";
}

function revalidatePaymentSurfaces(): void {
  revalidatePath("/owner/payments");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tables");
  revalidatePath("/owner");
}

function back(code: string, billId?: string): never {
  const params = new URLSearchParams({ notice: code });

  if (billId) params.set("bill", billId);

  redirect(`/owner/payments?${params.toString()}`);
}

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function readNumber(formData: FormData, key: string): number | null {
  const raw = readText(formData, key);
  if (raw === "") return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Table name for the notification, e.g. "Table 03".
 * Reads tableLabel / tableName / tableId from the bill when present
 * ("t03" and "03" both become "Table 03").
 */
function tableText(bill: object): string | null {
  const b = bill as {
    tableLabel?: unknown;
    tableName?: unknown;
    tableId?: unknown;
  };

  const raw = [b.tableLabel, b.tableName, b.tableId].find(
    (value) => typeof value === "string" && value.trim() !== "",
  ) as string | undefined;

  if (!raw) return null;

  const text = raw.trim();

  if (/^table\b/i.test(text)) return text;

  const digits = text.match(/^t?0*(\d+)$/i);

  return digits
    ? `Table ${digits[1].padStart(2, "0")}`
    : `Table ${text}`;
}

/** Payment date and time, e.g. "14 Oct 2026, 5:19 PM" (India time). */
function paymentDateTime(date: Date): string {
  return date
    .toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    })
    .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
}

function paymentFailureCode(reason: string): string {
  switch (reason) {
    case "not-found":
      return "missing-bill";
    case "already-paid":
      return "already-paid";
    case "invalid-method":
      return "invalid-method";
    case "invalid-amount":
      return "invalid-amount";
    case "overpayment":
      return "overpayment";
    case "missing-reference":
      return "missing-reference";
    case "invalid-reference":
      return "invalid-reference";
    case "duplicate-reference":
      return "duplicate-reference";
    case "table-mismatch":
      return "table-missing";
    default:
      return "invalid";
  }
}

function refundFailureCode(reason: string): string {
  switch (reason) {
    case "not-found":
      return "missing-payment";
    case "invalid-amount":
      return "refund-invalid-amount";
    case "invalid-reason":
      return "refund-invalid-reason";
    case "exceeds-paid":
      return "refund-exceeds";
    default:
      return "invalid";
  }
}

export async function recordPaymentAction(
  formData: FormData,
): Promise<void> {
  if (!(await isOwner())) return back("forbidden");

  const billId = readText(formData, "billId");
  if (!billId) return back("invalid");

  // Server-side allowlist: reject UPI, Card, and all unknown methods.
  const method = readText(formData, "method");
  if (method !== "cash" && method !== "qr") {
    return back("invalid-method", billId);
  }

  const amount = readNumber(formData, "amountRupees");
  if (amount === null) return back("invalid-amount", billId);

  let result;

  try {
    result = await recordBillPaymentDb(DEMO_RESTAURANT_ID, billId, {
      method,
      amountRupees: amount,
      transactionId: formData.get("transactionId"),
      idempotencyKey: formData.get("idempotencyKey"),
    });
  } catch (err) {
    console.error("recordPaymentAction failed", err);
    return back("invalid", billId);
  }

  revalidatePaymentSurfaces();

  if (!result.ok) {
    return back(paymentFailureCode(result.reason), billId);
  }

  if (result.settled) {
    const table = tableText(result.bill);
    const paidAt = paymentDateTime(new Date());

    await notify({
      type: "PAYMENT_RECEIVED",
      title: table ? `Payment received — ${table}` : "Payment received",
      message:
        `${table ? `${table}: ` : ""}Bill paid` +
        `${result.bill.paymentMethod ? ` via ${result.bill.paymentMethod}` : ""}: ` +
        `₹${result.bill.totalRupees}. Paid on ${paidAt}.`,
      dedupeKey: `payment:${result.bill.id}`,
    });
  }

  if (
    result.settled &&
    result.bill.paymentMethod !== null &&
    result.bill.totalRupees > 0
  ) {
    try {
      await onBillPaymentConfirmed(
        result.bill.id,
        result.bill.paymentMethod,
      );
    } catch (error) {
      console.error("Payment hook failed for bill", result.bill.id, error);
    }
  }

  return back(result.settled ? "paid" : "partial", result.bill.id);
}

export async function refundPaymentAction(
  formData: FormData,
): Promise<void> {
  if (!(await isOwner())) return back("forbidden");

  const paymentId = readText(formData, "paymentId");
  if (!paymentId) return back("invalid");

  const amount = readNumber(formData, "amountRupees");
  if (amount === null) return back("refund-invalid-amount");

  const reason = readText(formData, "reason");
  let result;

  try {
    result = await refundPaymentDb(DEMO_RESTAURANT_ID, paymentId, amount, reason);
  } catch (err) {
    console.error("refundPaymentAction failed", err);
    return back("invalid");
  }

  revalidatePaymentSurfaces();

  if (!result.ok) {
    return back(refundFailureCode(result.reason));
  }

  try {
    await reverseLoyaltyForRefundDb(DEMO_RESTAURANT_ID, result.refund.billId);
  } catch (error) {
    console.error("Loyalty reversal failed for payment", paymentId, error);
  }

  try {
    onPaymentRefunded({
      refundId: result.refund.id,
      paymentId,
      amountRupees: amount,
      reason,
    });
  } catch (error) {
    console.error("Refund hook failed for payment", paymentId, error);
  }

  return back("refunded", result.refund.billId);
}