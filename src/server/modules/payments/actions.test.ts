import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ role: null as string | null }));
const nav = vi.hoisted(() => ({ redirect: vi.fn() }));
const hook = vi.hoisted(() => ({ onPaid: vi.fn() }));

vi.mock("@/server/modules/auth/session", () => ({
  getDemoRole: async () => session.role,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: nav.redirect }));

vi.mock("@/server/modules/financial-pots/payment-hook", () => ({
  onBillPaymentConfirmed: hook.onPaid,
  onPaymentRefunded: vi.fn(),
}));

import {
  createDemoOrder,
  createRestaurantTable,
  getBillPaymentSummary,
  getPayments,
  getRefunds,
  issueBill,
  transitionOrder,
} from "@/server/modules/demo-store/store";
import { recordPaymentAction, refundPaymentAction } from "./actions";

let tableCounter = 0;
let referenceCounter = 0;

function unpaidBill() {
  tableCounter += 1;
  const created = createRestaurantTable(`Payment Action Test ${tableCounter}`);

  if (!created.ok) {
    throw new Error("Could not create test table");
  }

  const order = createDemoOrder(created.table.id, [
    { code: "125", name: "Butter Naan", qty: 2, priceRupees: 50 },
  ]);

  transitionOrder(order.id);
  transitionOrder(order.id);
  transitionOrder(order.id);

  const issued = issueBill(order.id, {
    gstPercent: 0,
    serviceChargePercent: 0,
    discountRupees: 0,
  });

  if (!issued.ok) {
    throw new Error("Could not create test bill");
  }

  return issued.bill;
}

function paymentForm(values: {
  billId: string;
  method?: string;
  amount?: string;
  reference?: string;
}) {
  const data = new FormData();
  data.set("billId", values.billId);
  data.set("method", values.method ?? "cash");
  data.set("amountRupees", values.amount ?? "100");
  data.set("transactionId", values.reference ?? "");
  return data;
}

function refundForm(values: { paymentId: string; amount?: string; reason?: string }) {
  const data = new FormData();
  data.set("paymentId", values.paymentId);
  data.set("amountRupees", values.amount ?? "10");
  data.set("reason", values.reason ?? "Customer complaint");
  return data;
}

function lastRedirect(): string {
  const calls = nav.redirect.mock.calls;
  return String(calls[calls.length - 1]?.[0] ?? "");
}

describe("payment actions", () => {
  beforeEach(() => {
    session.role = "owner";
    nav.redirect.mockClear();
    hook.onPaid.mockClear();
  });

  it("rejects payments from signed-out, kitchen and admin callers", async () => {
    for (const role of [null, "kitchen", "admin"]) {
      session.role = role;
      const bill = unpaidBill();

      await recordPaymentAction(paymentForm({ billId: bill.id }));

      expect(lastRedirect()).toContain("notice=forbidden");
      expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
      expect(hook.onPaid).not.toHaveBeenCalled();
    }
  });

  it("records a full payment once and fires the pots hook once", async () => {
    const bill = unpaidBill();

    await recordPaymentAction(paymentForm({ billId: bill.id, method: "cash" }));
    expect(lastRedirect()).toContain("notice=paid");
    expect(bill.paymentMethod).toBe("cash");

    await recordPaymentAction(paymentForm({ billId: bill.id, method: "card" }));
    expect(lastRedirect()).toContain("notice=already-paid");
    expect(bill.paymentMethod).toBe("cash");
    expect(hook.onPaid).toHaveBeenCalledTimes(1);
  });

  it("records a partial payment without firing the hook or settling the bill", async () => {
    const bill = unpaidBill();

    await recordPaymentAction(paymentForm({ billId: bill.id, amount: "40" }));

    expect(lastRedirect()).toContain("notice=partial");
    expect(getBillPaymentSummary(bill).status).toBe("partial");
    expect(bill.paidAt).toBeNull();
    expect(hook.onPaid).not.toHaveBeenCalled();

    await recordPaymentAction(paymentForm({ billId: bill.id, amount: "60" }));

    expect(lastRedirect()).toContain("notice=paid");
    expect(getBillPaymentSummary(bill).status).toBe("paid");
    expect(hook.onPaid).toHaveBeenCalledTimes(1);
  });

  it("rejects overpayment, zero, negative and non-numeric amounts", async () => {
    const bill = unpaidBill();

    await recordPaymentAction(paymentForm({ billId: bill.id, amount: "101" }));
    expect(lastRedirect()).toContain("notice=overpayment");

    for (const amount of ["0", "-5", "abc", ""]) {
      await recordPaymentAction(paymentForm({ billId: bill.id, amount }));
      expect(lastRedirect()).toContain("notice=invalid-amount");
    }

    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("rejects an invalid method, including online", async () => {
    const bill = unpaidBill();

    for (const method of ["online", "bitcoin", ""]) {
      await recordPaymentAction(paymentForm({ billId: bill.id, method }));
      expect(lastRedirect()).toContain("notice=invalid-method");
    }

    expect(getBillPaymentSummary(bill).paidRupees).toBe(0);
  });

  it("enforces transaction IDs for UPI and rejects a reused one", async () => {
    const first = unpaidBill();
    const second = unpaidBill();
    referenceCounter += 1;
    const id = `ACTION${referenceCounter}00000`;

    await recordPaymentAction(paymentForm({ billId: first.id, method: "upi" }));
    expect(lastRedirect()).toContain("notice=missing-reference");

    await recordPaymentAction(
      paymentForm({ billId: first.id, method: "upi", reference: "12" })
    );
    expect(lastRedirect()).toContain("notice=invalid-reference");

    await recordPaymentAction(
      paymentForm({ billId: first.id, method: "upi", reference: id })
    );
    expect(lastRedirect()).toContain("notice=paid");

    await recordPaymentAction(
      paymentForm({ billId: second.id, method: "upi", reference: id })
    );
    expect(lastRedirect()).toContain("notice=duplicate-reference");
    expect(getBillPaymentSummary(second).paidRupees).toBe(0);
  });

  it("reports a missing bill", async () => {
    await recordPaymentAction(paymentForm({ billId: "nope" }));

    expect(lastRedirect()).toContain("notice=missing-bill");
  });

  it("rejects refunds from non-owners and applies valid owner refunds", async () => {
    const bill = unpaidBill();
    await recordPaymentAction(paymentForm({ billId: bill.id }));
    const payment = getPayments().find((p) => p.billId === bill.id);
    const paymentId = payment?.id ?? "";
    const refundsBefore = getRefunds().length;

    session.role = "kitchen";
    await refundPaymentAction(refundForm({ paymentId }));
    expect(lastRedirect()).toContain("notice=forbidden");
    expect(getRefunds()).toHaveLength(refundsBefore);

    session.role = "owner";
    await refundPaymentAction(refundForm({ paymentId, amount: "30" }));
    expect(lastRedirect()).toContain("notice=refunded");
    expect(getBillPaymentSummary(bill).refundedRupees).toBe(30);

    await refundPaymentAction(refundForm({ paymentId, amount: "71" }));
    expect(lastRedirect()).toContain("notice=refund-exceeds");

    await refundPaymentAction(refundForm({ paymentId, reason: "" }));
    expect(lastRedirect()).toContain("notice=refund-invalid-reason");

    await refundPaymentAction(refundForm({ paymentId, amount: "0" }));
    expect(lastRedirect()).toContain("notice=refund-invalid-amount");

    expect(getBillPaymentSummary(bill).refundedRupees).toBe(30);
  });
});