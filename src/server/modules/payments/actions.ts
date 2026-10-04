"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDemoRole } from "@/server/modules/auth/session";
import {
  recordBillPayment,
  refundPayment,
} from "@/server/modules/demo-store/store";
import { notify } from "@/server/modules/notifications/store";

import {
  onBillPaymentConfirmed,
  onPaymentRefunded,
} from "@/server/modules/financial-pots/payment-hook";

/** Payments are owner-only financial operations, checked on the server. */
async function isOwner(): Promise<boolean> {
  const role = await getDemoRole();
  return role === "owner";
}

function revalidatePaymentSurfaces(): void {
  revalidatePath("/owner/payments");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tables");
  revalidatePath("/owner");
}

/** redirect() throws internally, so call it as the last statement of a branch. */
function back(code: string, billId?: string): never {
  const params = new URLSearchParams({ notice: code });

  if (billId) {
    params.set("bill", billId);
  }

  redirect(`/owner/payments?${params.toString()}`);
}

function readText(formData: FormData, key: string): string {
  const raw = formData.get(key);

  return typeof raw === "string" ? raw.trim() : "";
}

/** Missing, empty or non-numeric input returns null. */
function readNumber(formData: FormData, key: string): number | null {
  const raw = readText(formData, key);

  if (raw === "") {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
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

/**
 * Records one payment (full or partial) against a bill. The bill, its
 * order/table, the method, the amount against the remaining balance and
 * the reference ID are all validated in the store — nothing the browser
 * sends is trusted as a total.
 */
export async function recordPaymentAction(formData: FormData): Promise<void> {
  if (!(await isOwner())) {
    return back("forbidden");
  }

  const billId = readText(formData, "billId");

  if (billId === "") {
    return back("invalid");
  }

  const amount = readNumber(formData, "amountRupees");

  if (amount === null) {
    return back("invalid-amount", billId);
  }

  const result = recordBillPayment(billId, {
    method: formData.get("method"),
    amountRupees: amount,
    transactionId: formData.get("transactionId"),
  });

  // Revalidate on failure too, so a stale screen picks up the latest state.
  revalidatePaymentSurfaces();

  if (!result.ok) {
    return back(paymentFailureCode(result.reason), billId);
  }
    if (result.settled) {
    notify({
      type: "PAYMENT_RECEIVED",
      title: "Payment received",
      message: `Bill paid${result.bill.paymentMethod ? ` via ${result.bill.paymentMethod}` : ""}: ₹${result.bill.totalRupees}.`,
      dedupeKey: `payment:${result.bill.id}`,
    });
  }

  // Pots react only to a fully settled bill with real money behind it, and
  // only once. The payment is already recorded, so a hook failure must not
  // undo it.
  if (
    result.settled &&
    result.bill.paymentMethod !== null &&
    result.bill.totalRupees > 0
  ) {
    try {
      onBillPaymentConfirmed(result.bill.id, result.bill.paymentMethod);
    } catch (error) {
      console.error("Payment hook failed for bill", result.bill.id, error);
    }
  }

  return back(result.settled ? "paid" : "partial", result.bill.id);
}

/** Records a refund against one existing payment (owner only). */
export async function refundPaymentAction(formData: FormData): Promise<void> {
  if (!(await isOwner())) {
    return back("forbidden");
  }

  const paymentId = readText(formData, "paymentId");

  if (paymentId === "") {
    return back("invalid");
  }

  const amount = readNumber(formData, "amountRupees");

  if (amount === null) {
    return back("refund-invalid-amount");
  }

  const result = refundPayment(paymentId, amount, readText(formData, "reason"));

  revalidatePaymentSurfaces();

  if (!result.ok) {
    return back(refundFailureCode(result.reason));
  }
    try {
    onPaymentRefunded({
      refundId: result.refund.id,
      paymentId,
      amountRupees: amount,
      reason: readText(formData, "reason"),
    });
  } catch (error) {
    console.error("Refund hook failed for payment", paymentId, error);
  }
  
  return back("refunded", result.refund.billId);
}