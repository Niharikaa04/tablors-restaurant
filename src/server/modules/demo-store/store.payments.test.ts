import { describe, expect, it } from "vitest";

import {
  createDemoOrder,
  createRestaurantTable,
  getBillPaymentSummary,
  getDailyCollection,
  getPayments,
  getTableById,
  issueBill,
  recordBillPayment,
  refundPayment,
  transitionOrder,
  type RecordPaymentInput,
} from "./store";

let tableCounter = 0;
let referenceCounter = 0;

/** Every test gets its own table so state never leaks between tests. */
function newTable(): string {
  tableCounter += 1;
  const created = createRestaurantTable(`Payment Test ${tableCounter}`);

  if (!created.ok) {
    throw new Error("Could not create test table");
  }

  return created.table.id;
}

function reference(): string {
  referenceCounter += 1;
  return `TXN${referenceCounter}00000`;
}

/** A billed, unpaid bill. 2 × ₹50 = ₹100, no GST, minus the discount. */
function unpaidBill(discountRupees = 0) {
  const tableId = newTable();
  const order = createDemoOrder(tableId, [
    { code: "125", name: "Butter Naan", qty: 2, priceRupees: 50 },
  ]);

  transitionOrder(order.id);
  transitionOrder(order.id);
  transitionOrder(order.id);

  const issued = issueBill(order.id, {
    gstPercent: 0,
    serviceChargePercent: 0,
    discountRupees,
  });

  if (!issued.ok) {
    throw new Error("Could not create test bill");
  }

  return issued.bill;
}

function mustPay(billId: string, input: RecordPaymentInput) {
  const result = recordBillPayment(billId, input);

  if (!result.ok) {
    throw new Error(`Payment failed: ${result.reason}`);
  }

  return result;
}

describe("payment status", () => {
  it("starts unpaid with the full balance remaining", () => {
    const bill = unpaidBill();
    const summary = getBillPaymentSummary(bill);

    expect(summary).toMatchObject({
      status: "unpaid",
      totalRupees: 100,
      paidRupees: 0,
      remainingRupees: 100,
    });
    expect(bill.paidAt).toBeNull();
  });
});

describe("recordBillPayment", () => {
  it("records a full cash payment, marks the bill paid and releases the table", () => {
    const bill = unpaidBill();

    const result = mustPay(bill.id, { method: "cash", amountRupees: 100 });

    expect(result.settled).toBe(true);
    expect(bill.paymentMethod).toBe("cash");
    expect(bill.paidAt).not.toBeNull();
    expect(getBillPaymentSummary(bill).status).toBe("paid");
    expect(getTableById(bill.tableId)).toMatchObject({
      status: "available",
      currentOrderId: null,
    });
  });

  it("rejects an invalid method, including online, without recording anything", () => {
    const bill = unpaidBill();

    for (const method of ["bitcoin", "online", "", null, 5]) {
      expect(
        recordBillPayment(bill.id, { method, amountRupees: 100 })
      ).toMatchObject({ ok: false, reason: "invalid-method" });
    }

    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("rejects zero, negative, fractional and non-numeric amounts", () => {
    const bill = unpaidBill();

    for (const amountRupees of [0, -10, 2.5, Number.NaN, "100", null]) {
      expect(
        recordBillPayment(bill.id, { method: "cash", amountRupees })
      ).toMatchObject({ ok: false, reason: "invalid-amount" });
    }

    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("rejects an overpayment and reports the remaining balance", () => {
    const bill = unpaidBill();

    expect(
      recordBillPayment(bill.id, { method: "cash", amountRupees: 101 })
    ).toEqual({ ok: false, reason: "overpayment", remainingRupees: 100 });
    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("rejects a second payment on a fully paid bill", () => {
    const bill = unpaidBill();

    mustPay(bill.id, { method: "cash", amountRupees: 100 });

    expect(
      recordBillPayment(bill.id, { method: "cash", amountRupees: 1 })
    ).toMatchObject({ ok: false, reason: "already-paid" });
    expect(getBillPaymentSummary(bill).paidRupees).toBe(100);
  });

  it("returns not-found for a missing bill", () => {
    expect(
      recordBillPayment("nope", { method: "cash", amountRupees: 10 })
    ).toEqual({ ok: false, reason: "not-found" });
  });

  it("requires a transaction ID for UPI and Card but not for Cash", () => {
    const bill = unpaidBill();

    expect(
      recordBillPayment(bill.id, { method: "upi", amountRupees: 10 })
    ).toMatchObject({ ok: false, reason: "missing-reference" });
    expect(
      recordBillPayment(bill.id, { method: "card", amountRupees: 10, transactionId: "  " })
    ).toMatchObject({ ok: false, reason: "missing-reference" });
    expect(
      recordBillPayment(bill.id, { method: "cash", amountRupees: 10 })
    ).toMatchObject({ ok: true });
  });

  it("validates the transaction ID format", () => {
    const bill = unpaidBill();

    for (const transactionId of ["12", "has space 123", "x".repeat(41), "bad*id123", 12345678]) {
      expect(
        recordBillPayment(bill.id, { method: "upi", amountRupees: 10, transactionId })
      ).toMatchObject({ ok: false, reason: "invalid-reference" });
    }

    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("rejects a transaction ID that was already recorded, ignoring case", () => {
    const first = unpaidBill();
    const second = unpaidBill();
    const id = reference();

    mustPay(first.id, { method: "upi", amountRupees: 100, transactionId: id });

    expect(
      recordBillPayment(second.id, {
        method: "upi",
        amountRupees: 100,
        transactionId: id.toLowerCase(),
      })
    ).toMatchObject({ ok: false, reason: "duplicate-reference" });
  });

  it("supports a partial payment, keeps the table occupied, then settles the balance", () => {
    const bill = unpaidBill();

    const first = mustPay(bill.id, { method: "cash", amountRupees: 40 });

    expect(first.settled).toBe(false);
    expect(getBillPaymentSummary(bill)).toMatchObject({
      status: "partial",
      paidRupees: 40,
      remainingRupees: 60,
    });
    expect(bill.paidAt).toBeNull();
    expect(bill.paymentMethod).toBeNull();
    expect(getTableById(bill.tableId)?.status).toBe("occupied");

    // More than the remaining balance is still rejected.
    expect(
      recordBillPayment(bill.id, { method: "cash", amountRupees: 61 })
    ).toMatchObject({ ok: false, reason: "overpayment", remainingRupees: 60 });

    const last = mustPay(bill.id, {
      method: "upi",
      amountRupees: 60,
      transactionId: reference(),
    });

    expect(last.settled).toBe(true);
    expect(getBillPaymentSummary(bill)).toMatchObject({
      status: "paid",
      paidRupees: 100,
      remainingRupees: 0,
    });
    // UPI took the larger share of the money.
    expect(bill.paymentMethod).toBe("upi");
    expect(bill.paidAt).not.toBeNull();
    expect(getTableById(bill.tableId)?.status).toBe("available");
  });

  it("closes a fully discounted ₹0 bill with a ₹0 payment only", () => {
    const bill = unpaidBill(100);

    expect(bill.totalRupees).toBe(0);
    expect(
      recordBillPayment(bill.id, { method: "cash", amountRupees: 5 })
    ).toMatchObject({ ok: false, reason: "invalid-amount" });

    const result = mustPay(bill.id, { method: "cash", amountRupees: 0 });

    expect(result.settled).toBe(true);
    expect(bill.paidAt).not.toBeNull();
    expect(getBillPaymentSummary(bill).status).toBe("paid");
  });
});

describe("refundPayment", () => {
  it("records a refund against the payment and preserves the payment", () => {
    const bill = unpaidBill();
    const paid = mustPay(bill.id, { method: "cash", amountRupees: 100 });

    const refund = refundPayment(paid.payment.id, 30, "Wrong item served");

    expect(refund.ok).toBe(true);

    if (refund.ok) {
      expect(refund.refund).toMatchObject({
        paymentId: paid.payment.id,
        billId: bill.id,
        amountRupees: 30,
        status: "completed",
      });
      expect(refund.refund.refundedAt).toBeGreaterThan(0);
    }

    const summary = getBillPaymentSummary(bill);

    expect(summary.refundedRupees).toBe(30);
    expect(summary.status).toBe("paid");
    // The original payment record is untouched.
    const stored = getPayments().find((p) => p.id === paid.payment.id);
    expect(stored?.amountRupees).toBe(100);
  });

  it("never refunds more than the payment still holds", () => {
    const bill = unpaidBill();
    const paid = mustPay(bill.id, { method: "cash", amountRupees: 100 });

    refundPayment(paid.payment.id, 30, "Wrong item served");

    expect(refundPayment(paid.payment.id, 71, "Too much")).toEqual({
      ok: false,
      reason: "exceeds-paid",
      refundableRupees: 70,
    });

    expect(refundPayment(paid.payment.id, 70, "Rest of it").ok).toBe(true);
    expect(getBillPaymentSummary(bill).status).toBe("refunded");
    expect(refundPayment(paid.payment.id, 1, "Again")).toMatchObject({
      ok: false,
      reason: "exceeds-paid",
    });
  });

  it("validates amount, reason and payment id", () => {
    const bill = unpaidBill();
    const paid = mustPay(bill.id, { method: "cash", amountRupees: 100 });

    for (const amount of [0, -1, 2.5, Number.NaN, "10"]) {
      expect(refundPayment(paid.payment.id, amount, "Valid reason")).toMatchObject({
        ok: false,
        reason: "invalid-amount",
      });
    }

    for (const reason of ["", "  ", "ab", "x".repeat(201), 42]) {
      expect(refundPayment(paid.payment.id, 10, reason)).toMatchObject({
        ok: false,
        reason: "invalid-reason",
      });
    }

    expect(refundPayment("nope", 10, "Valid reason")).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(getBillPaymentSummary(bill).refundedRupees).toBe(0);
  });
});

describe("getDailyCollection", () => {
  it("counts only recorded money: partial payments count what was paid, unpaid bills count nothing", () => {
    const before = getDailyCollection();

    unpaidBill();

    const partial = unpaidBill();
    mustPay(partial.id, { method: "cash", amountRupees: 40 });

    const full = unpaidBill();
    mustPay(full.id, { method: "upi", amountRupees: 100, transactionId: reference() });

    const after = getDailyCollection();

    expect(after.byMethod.cash - before.byMethod.cash).toBe(40);
    expect(after.byMethod.upi - before.byMethod.upi).toBe(100);
    expect(after.byMethod.card - before.byMethod.card).toBe(0);
    expect(after.grossRupees - before.grossRupees).toBe(140);
    expect(after.paymentCount - before.paymentCount).toBe(2);
  });

  it("subtracts refunds recorded today from the net figure", () => {
    const before = getDailyCollection();
    const bill = unpaidBill();
    const paid = mustPay(bill.id, { method: "cash", amountRupees: 100 });

    refundPayment(paid.payment.id, 25, "Customer complaint");

    const after = getDailyCollection();

    expect(after.grossRupees - before.grossRupees).toBe(100);
    expect(after.refundedRupees - before.refundedRupees).toBe(25);
    expect(after.netRupees - before.netRupees).toBe(75);
  });

  it("does not invent collection for days with no payments", () => {
    const farFuture = Date.now() + 3 * 24 * 60 * 60 * 1000;

    expect(getDailyCollection(farFuture)).toMatchObject({
      grossRupees: 0,
      refundedRupees: 0,
      netRupees: 0,
      paymentCount: 0,
    });
  });
});