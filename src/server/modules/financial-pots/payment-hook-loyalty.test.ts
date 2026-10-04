import { beforeEach, describe, expect, it, vi } from "vitest";
import { onBillPaymentConfirmed, onPaymentRefunded } from "./payment-hook";
import { getLoyaltyRuntime, publishLoyaltyRule, resetLoyaltyRuntimeForTests } from "./loyalty-runtime";
import { DEMO_BUSINESS_ID as B, getPotsRuntime, resetPotsRuntimeForTests, addCustomPot } from "@/server/modules/pots/runtime";
import type { LoyaltyRule } from "./core/loyalty";

const store = vi.hoisted(() => ({ payments: [] as unknown[] }));
vi.mock("@/server/modules/demo-store/store", () => ({ getPayments: () => store.payments }));

const rule: Omit<LoyaltyRule, "version"> = { businessId: B, enabled: true, pointsPerBlock: 1, blockPaise: 1000, deductDiscounts: false, excludeGst: true, excludeServiceCharge: true, excludeDelivery: true, excludeTips: true, excludedCategories: [], excludedItemIds: [], campaigns: [], refundPolicy: "PROPORTIONAL" };
const ctx = { customerId: "c1", bill: { items: [{ id: "i", category: "f", amountPaise: 90000 }], gstPaise: 10000, serviceChargePaise: 0, deliveryPaise: 0, tipPaise: 0, discountPaise: 0, totalPaise: 100000 } };

describe("billing hook drives BOTH ledgers from one payment", () => {
  beforeEach(() => { resetPotsRuntimeForTests(); resetLoyaltyRuntimeForTests(); store.payments.length = 0; vi.spyOn(console, "log").mockImplementation(() => {}); vi.spyOn(console, "error").mockImplementation(() => {}); });

  it("no loyalty rule -> money allocated, no points", () => {
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 1000 });
    onBillPaymentConfirmed("b1", "cash", ctx);
    expect(getLoyaltyRuntime().ledger.balance(B, "c1")).toBe(0);
    expect(getPotsRuntime().ledger.merchantFunds(B)).toBe(100000);
  });
  it("earns exactly once, reverses proportionally on refund, Pots untouched by points", () => {
    publishLoyaltyRule(getLoyaltyRuntime(), rule, "OWNER");
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 1000 });
    onBillPaymentConfirmed("b1", "cash", ctx); onBillPaymentConfirmed("b1", "cash", ctx);
    const lr = getLoyaltyRuntime();
    expect(lr.ledger.balance(B, "c1")).toBe(90);
    expect(getPotsRuntime().ledger.merchantFunds(B)).toBe(100000);
    onPaymentRefunded({ refundId: "r1", paymentId: "p1", amountRupees: 500, reason: "x" });
    expect(lr.ledger.balance(B, "c1")).toBe(45);
    expect(getPotsRuntime().ledger.reconcile(B, getPotsRuntime().potIds).ok).toBe(true);
  });
  it("only the owner publishes loyalty rules; versions append", () => {
    const lr = getLoyaltyRuntime();
    expect(() => publishLoyaltyRule(lr, rule, "MANAGER")).toThrow();
    expect(publishLoyaltyRule(lr, rule, "OWNER").version).toBe(1); expect(publishLoyaltyRule(lr, rule, "OWNER").version).toBe(2);
  });
  it("owner can add custom Pots that receive allocations", () => {
    const rt = getPotsRuntime();
    expect(() => addCustomPot(rt, "Rent", "MANAGER")).toThrow();
    const rent = addCustomPot(rt, "Rent", "OWNER");
    expect(() => addCustomPot(rt, "rent", "OWNER")).toThrow();
    rt.registry.publish(B, { ruleKey: "rent", potId: rent.id, method: "PERCENTAGE", value: 1000, priority: 1, effectiveFrom: new Date(0) }, { id: "o", role: "OWNER" }, { stepUpVerified: true, reason: "t", at: new Date() });
    store.payments.push({ id: "p1", billId: "b1", amountRupees: 1000 });
    onBillPaymentConfirmed("b1", "cash");
    expect(rt.ledger.potBalance(B, rent.id)).toBe(10000);
  });
});
