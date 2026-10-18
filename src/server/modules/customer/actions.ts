"use server";

import { revalidatePath } from "next/cache";

import { DEMO_RESTAURANT_ID } from "@/server/modules/auth/session";
import {
  getBillByOrderIdDb,
  getBillPaymentSummaryDb,
  getBillReceiptDb,
  issueBillDb,
  type BillReceipt,
  recordBillPaymentDb,
} from "@/server/modules/billing/db-billing";
import { getOrderFromDb } from "@/server/modules/orders/db-orders";
import { getTableByIdDb } from "@/server/modules/data/tables-db";
import {
  DEFAULT_GST_PERCENT,
  type Bill,
  type BillPaymentSummary,
} from "@/server/modules/demo-store/store";
import { onBillPaymentConfirmed } from "@/server/modules/financial-pots/payment-hook";
import {
  getBillLoyaltyViewDb,
  holdRedemptionDb,
  identifyCustomerOnBillDb,
  releaseRedemptionDb,
  type BillLoyaltyView,
} from "@/server/modules/loyalty-db/db-loyalty";

const UPI_ID = process.env.RESTAURANT_UPI_ID?.trim() ?? "";
const RESTAURANT_NAME = process.env.PUBLIC_COMPANY_NAME?.trim() || "Tablor's";

export type CustomerBillState = {
  billId: string;
  totalRupees: number;
  paidRupees: number;
  remainingRupees: number;
  status: BillPaymentSummary["status"];
  upiConfigured: boolean;
  upiUri: string | null;
  qrUrl: string | null;
  restaurantName: string;
  /** Itemised receipt built server-side from stored order/bill/payment rows. */
  receipt: BillReceipt | null;
  /** Loyalty points / rewards for the member identified on this bill. */
  loyalty: BillLoyaltyView;
};

export type CustomerOrderState =
  | {
      ok: true;
      orderStatus: string;
      bill: CustomerBillState | null;
    }
  | { ok: false; error: string };

async function buildBillState(bill: Bill): Promise<CustomerBillState> {
  const summary =
    (await getBillPaymentSummaryDb(DEMO_RESTAURANT_ID, bill.id)) ??
    ({
      totalRupees: bill.totalRupees,
      paidRupees: 0,
      remainingRupees: bill.totalRupees,
      status: "unpaid",
    } as BillPaymentSummary);
  const upiUri = UPI_ID
    ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(
        RESTAURANT_NAME
      )}&am=${encodeURIComponent(String(summary.remainingRupees))}&cu=INR&tn=${encodeURIComponent(
        `Bill ${bill.id}`
      )}`
    : null;

  const receipt = await getBillReceiptDb(DEMO_RESTAURANT_ID, bill.id);
  const loyalty = await getBillLoyaltyViewDb(DEMO_RESTAURANT_ID, bill.tableId, bill.id);

  const qrUrl = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
        upiUri
      )}`
    : null;

  return {
    billId: bill.id,
    totalRupees: summary.totalRupees,
    paidRupees: summary.paidRupees,
    remainingRupees: summary.remainingRupees,
    status: summary.status,
    upiConfigured: Boolean(UPI_ID),
    upiUri,
    qrUrl,
    restaurantName: RESTAURANT_NAME,
    receipt,
    loyalty,
  };
}

async function validateCustomerOrder(tableId: string, orderId: string) {
  const table = await getTableByIdDb(DEMO_RESTAURANT_ID, tableId);
  if (!table) return { ok: false as const, error: "Table not found." };

  const order = await getOrderFromDb(DEMO_RESTAURANT_ID, orderId);
  if (!order || order.tableId !== tableId) {
    return { ok: false as const, error: "Order not found for this table." };
  }

  return { ok: true as const, table, order };
}

/**
 * Reads the current bill/payment state for the exact order on this table.
 * The customer device uses this for its small polling loop.
 */
export async function getCustomerOrderState(
  tableId: string,
  orderId: string
): Promise<CustomerOrderState> {
  const validated = await validateCustomerOrder(tableId, orderId);
  if (!validated.ok) return { ok: false, error: validated.error };

  const bill = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, orderId);

  return {
    ok: true,
    orderStatus: validated.order.status,
    bill: bill ? await buildBillState(bill) : null,
  };
}

/**
 * Customer-facing bill generation for the physical table device.
 * It can only bill the exact order belonging to the supplied table and only
 * after the kitchen has marked that order SERVED. The restaurant's configured
 * default GST is used; owner billing remains the place for manual discounts
 * and service-charge adjustments.
 */
export async function generateCustomerBill(
  tableId: string,
  orderId: string
): Promise<
  | { ok: true; bill: CustomerBillState }
  | { ok: false; error: string }
> {
  const validated = await validateCustomerOrder(tableId, orderId);
  if (!validated.ok) return { ok: false, error: validated.error };

  const existing = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, orderId);
  if (existing) {
    return { ok: true, bill: await buildBillState(existing) };
  }

  if (validated.order.status !== "served") {
    return {
      ok: false,
      error: `Your order is ${validated.order.status}. The bill becomes available after it is served.`,
    };
  }

  const result = await issueBillDb(DEMO_RESTAURANT_ID, orderId, {
    gstPercent: DEFAULT_GST_PERCENT,
    serviceChargePercent: 0,
    discountRupees: 0,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "already-billed":
        return { ok: true, bill: await buildBillState(result.bill) };
      case "not-served":
        return { ok: false, error: "The bill is available after your order is served." };
      default:
        return { ok: false, error: "We could not generate the bill. Please ask your waiter." };
    }
  }

  revalidatePath(`/customer/${tableId}`);
  revalidatePath("/owner/billing");
  revalidatePath("/owner/payments");
  revalidatePath("/owner");

  return { ok: true, bill: await buildBillState(result.bill) };
}

/**
 * Demo/customer UPI confirmation. The customer must provide the UTR/reference
 * from the UPI app. No fake payment is created when UPI is not configured.
 * A real payment gateway can replace this action later without changing the
 * customer UI contract.
 */
export async function recordCustomerUpiPayment(
  tableId: string,
  orderId: string,
  transactionId: string
): Promise<
  | { ok: true; bill: CustomerBillState }
  | { ok: false; error: string }
> {
  const validated = await validateCustomerOrder(tableId, orderId);
  if (!validated.ok) return { ok: false, error: validated.error };

  if (!UPI_ID) {
    return {
      ok: false,
      error: "UPI payments are not configured for this restaurant yet.",
    };
  }

  const bill = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, orderId);
  if (!bill) {
    return { ok: false, error: "Generate your bill first." };
  }

  const summary = await getBillPaymentSummaryDb(DEMO_RESTAURANT_ID, bill.id);
  if (!summary) return { ok: false, error: "Generate your bill first." };

  if (summary.status === "paid" || summary.status === "refunded") {
    return { ok: true, bill: await buildBillState(bill) };
  }

  const cleanReference = transactionId.trim();
  if (!cleanReference) {
    return { ok: false, error: "Enter the UTR / transaction ID from your UPI app." };
  }

  const result = await recordBillPaymentDb(DEMO_RESTAURANT_ID, bill.id, {
    method: "qr", // Cash and QR are the only payment methods; UPI/QR payments are recorded as QR.
    amountRupees: summary.remainingRupees,
    transactionId: cleanReference,
  });

  if (!result.ok) {
    switch (result.reason) {
      case "missing-reference":
        return { ok: false, error: "UPI payment requires a transaction ID." };
      case "invalid-reference":
        return { ok: false, error: "Enter a valid UTR / transaction ID." };
      case "duplicate-reference":
        return { ok: false, error: "That transaction ID has already been used." };
      case "already-paid":
        return { ok: true, bill: await buildBillState(result.bill) };
      case "overpayment":
        return { ok: false, error: "The payment amount exceeds the remaining balance." };
      default:
        return { ok: false, error: "We could not record the payment. Please ask your waiter." };
    }
  }

  if (result.settled && result.bill.paymentMethod !== null && result.bill.totalRupees > 0) {
    try {
      await onBillPaymentConfirmed(result.bill.id, result.bill.paymentMethod);
    } catch (error) {
      console.error("Payment hook failed for customer payment", result.bill.id, error);
    }
  }

  revalidatePath(`/customer/${tableId}`);
  revalidatePath("/owner/payments");
  revalidatePath("/owner/billing");
  revalidatePath("/owner/tables");
  revalidatePath("/owner");

  return { ok: true, bill: await buildBillState(result.bill) };
}

// ---- loyalty (customer device) -------------------------------------------------

type LoyaltyResult =
  | { ok: true; bill: CustomerBillState }
  | { ok: false; message: string; bill: CustomerBillState | null };

async function withLoyaltyBill(
  tableId: string,
  orderId: string,
  run: (bill: Bill) => Promise<{ ok: true } | { ok: false; message: string }>
): Promise<LoyaltyResult> {
  const validated = await validateCustomerOrder(tableId, orderId);
  if (!validated.ok) return { ok: false, message: validated.error, bill: null };

  const bill = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, orderId);
  if (!bill) return { ok: false, message: "Generate the bill first.", bill: null };

  const result = await run(bill);
  const fresh = await getBillByOrderIdDb(DEMO_RESTAURANT_ID, orderId);
  const state = fresh ? await buildBillState(fresh) : null;

  if (!result.ok) return { ok: false, message: result.message, bill: state };
  if (!state) return { ok: false, message: "Bill not found.", bill: null };
  return { ok: true, bill: state };
}

export async function identifyLoyaltyMember(tableId: string, orderId: string, phone: string) {
  return withLoyaltyBill(tableId, orderId, (bill) =>
    identifyCustomerOnBillDb(DEMO_RESTAURANT_ID, tableId, bill.id, phone)
  );
}

export async function redeemLoyaltyReward(tableId: string, orderId: string, rewardId: string) {
  return withLoyaltyBill(tableId, orderId, (bill) =>
    holdRedemptionDb(DEMO_RESTAURANT_ID, tableId, bill.id, rewardId)
  );
}

export async function removeLoyaltyReward(tableId: string, orderId: string) {
  return withLoyaltyBill(tableId, orderId, (bill) =>
    releaseRedemptionDb(DEMO_RESTAURANT_ID, tableId, bill.id)
  );
}
