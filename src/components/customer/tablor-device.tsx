"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import type { MenuItem } from "@/server/modules/demo-store/store";
import { useCart } from "./cart-context";
import { MenuPane } from "./device/menu-pane";
import { KeypadPanel } from "./device/keypad-panel";
import { OrderPanel } from "./device/order-panel";
import { PaymentPanel } from "./device/payment-panel";

import {
  callWaiter,
  placeCustomerOrder,
} from "@/server/modules/orders/actions";

import {
  generateCustomerBill,
  getCustomerOrderState,
  recordCustomerUpiPayment,
  type CustomerBillState,
} from "@/server/modules/customer/actions";

const MAX_QTY = 99;
const MENU_REFRESH_MS = 10_000;
const PAYMENT_REFRESH_MS = 3_000;

export function TablorDevice({
  tableId,
  tableLabel,
  items,
  initialTrackedOrderId,
}: {
  tableId: string;
  tableLabel: string;
  items: MenuItem[];
  initialTrackedOrderId: string | null;
}) {
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState(0);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [lastOrderId, setLastOrderId] = useState<string | null>(
    initialTrackedOrderId
  );

  const [waiterCalling, setWaiterCalling] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [bill, setBill] = useState<CustomerBillState | null>(null);
  const [paymentPanelOpen, setPaymentPanelOpen] = useState(false);
  const [paymentPanelMode, setPaymentPanelMode] = useState<"bill" | "qr">(
    "bill"
  );

  const [generatingBill, setGeneratingBill] = useState(false);
  const [confirmingUpi, setConfirmingUpi] = useState(false);

  const selectedItem =
    items.find((item) => item.code === selectedCode) ?? null;

  /*
   * Keep customer payment/bill state synchronized with the server.
   */
  useEffect(() => {
    if (!lastOrderId) {
      return;
    }

    let cancelled = false;

    async function refreshPaymentState() {
      const orderId = lastOrderId;

      if (!orderId) {
        return;
      }

      const state = await getCustomerOrderState(tableId, orderId);

      if (cancelled || !state.ok) {
        return;
      }

      setBill(state.bill);

      if (state.bill?.status === "paid") {
        router.refresh();
      }
    }

    void refreshPaymentState();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPaymentState();
      }
    }, PAYMENT_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tableId, lastOrderId, router]);

  /*
   * Keep the device in step with the owner's menu changes.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, MENU_REFRESH_MS);

    return () => clearInterval(interval);
  }, [router]);

  const { syncWithMenu } = cart;

  /*
   * Keep the local cart synchronized with canonical menu availability.
   */
  useEffect(() => {
    syncWithMenu(items);
  }, [items, syncWithMenu]);

  /*
   * Automatically clear temporary information messages.
   */
  useEffect(() => {
    if (!infoMessage) {
      return;
    }

    const timeout = setTimeout(() => setInfoMessage(null), 4000);

    return () => clearTimeout(timeout);
  }, [infoMessage]);

  function handleSelectItem(item: MenuItem) {
    setSelectedCode(item.code);
    setQtyDraft(cart.getQty(item.code) || 1);
    setConfirmError(null);
  }

  function handleDigit(digit: string) {
    if (!selectedItem) {
      return;
    }

    setQtyDraft((prev) => {
      const next = Number(`${prev === 0 ? "" : prev}${digit}`);

      return Number.isFinite(next) ? Math.min(next, MAX_QTY) : prev;
    });
  }

  function handleBackspace() {
    if (!selectedItem) {
      return;
    }

    setQtyDraft((prev) => Math.floor(prev / 10));
  }

  function handleCommitQty() {
    if (!selectedItem) {
      return;
    }

    cart.setQty(selectedItem, qtyDraft);
    setSelectedCode(null);
    setQtyDraft(0);
  }

  function handleQtyPlus() {
    if (!selectedItem) {
      return;
    }

    setQtyDraft((prev) => Math.min(prev + 1, MAX_QTY));
  }

  function handleQtyMinus() {
    if (!selectedItem) {
      return;
    }

    setQtyDraft((prev) => Math.max(prev - 1, 0));
  }

  function handleClearAll() {
    cart.clearCart();
    setSelectedCode(null);
    setQtyDraft(0);
  }

  async function handleConfirmOrder() {
    if (cart.lines.length === 0) {
      return;
    }

    setConfirmSubmitting(true);
    setConfirmError(null);

    const result = await placeCustomerOrder({
      tableId,
      lines: cart.lines.map((line) => ({
        code: line.code,
        itemId: line.itemId,
        qty: line.qty,
      })),
    });

    setConfirmSubmitting(false);

    if (result.ok) {
      cart.clearCart();
      setSelectedCode(null);
      setQtyDraft(0);
      setBill(null);
      setLastOrderId(result.orderId);

      router.replace(`${pathname}?order=${result.orderId}`);
    } else {
      setConfirmError(result.error);
      router.refresh();
    }
  }

  async function handleCallWaiter() {
    setWaiterCalling(true);

    const result = await callWaiter(tableId);

    setWaiterCalling(false);

    setInfoMessage(
      result.ok
        ? "Waiter has been notified — someone will be with you shortly."
        : "Couldn't reach staff right now, please try again."
    );
  }

  /*
   * BILL GEN:
   * Generate the bill and open the bill view.
   */
  async function handleBillGen() {
    if (!lastOrderId) {
      setInfoMessage("Place your order first to generate a bill.");
      return;
    }

    setGeneratingBill(true);
    setConfirmError(null);

    const result = await generateCustomerBill(tableId, lastOrderId);

    setGeneratingBill(false);

    if (!result.ok) {
      setInfoMessage(result.error);
      return;
    }

    setBill(result.bill);
    setPaymentPanelMode("bill");
    setPaymentPanelOpen(true);
  }

  /*
   * QR GEN:
   * Generate the bill if necessary, then open the payment/QR view.
   */
  async function handleQrGen() {
    if (!lastOrderId) {
      setInfoMessage("Place your order first to generate a payment QR.");
      return;
    }

    if (!bill) {
      setGeneratingBill(true);
      setConfirmError(null);

      const result = await generateCustomerBill(tableId, lastOrderId);

      setGeneratingBill(false);

      if (!result.ok) {
        setInfoMessage(result.error);
        return;
      }

      setBill(result.bill);
    }

    setPaymentPanelMode("qr");
    setPaymentPanelOpen(true);
  }

  async function handleConfirmUpi(transactionId: string) {
    if (!lastOrderId) {
      return;
    }

    setConfirmingUpi(true);
    setConfirmError(null);

    const result = await recordCustomerUpiPayment(
      tableId,
      lastOrderId,
      transactionId
    );

    setConfirmingUpi(false);

    if (!result.ok) {
      setConfirmError(result.error);
      return;
    }

    setBill(result.bill);
    setPaymentPanelOpen(false);
    setInfoMessage("Payment recorded successfully.");

    if (result.bill.status === "paid") {
      router.refresh();
    }
  }

  function handleFeedback() {
    if (bill?.status === "paid") {
      router.refresh();
      return;
    }

    setInfoMessage(
      "Feedback becomes available after your bill is fully paid."
    );
  }

  return (
    <div
      className="tablor-device overflow-hidden rounded-2xl border-2 p-1.5 shadow-2xl sm:p-2"
      style={{
        borderColor: "var(--device-gold)",
        background: "var(--device-shell)",
      }}
    >
      <div className="flex items-center justify-center gap-2 py-1.5">
        <span
          className="text-sm font-bold tracking-wide"
          style={{ color: "var(--device-gold)" }}
        >
          Tablor&apos;s
        </span>

        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--device-lcd-muted)" }}
        >
          Table Ordering System
        </span>
      </div>

      <MenuPane
        items={items}
        selectedCode={selectedCode}
        onSelectItem={handleSelectItem}
        getQty={cart.getQty}
      />

      {lastOrderId && cart.lines.length === 0 && (
        <p
          className="px-4 py-2 text-center text-xs font-medium sm:px-6"
          style={{
            background: "var(--device-shell)",
            color: "var(--device-gold)",
          }}
        >
          Order placed — #{lastOrderId}. It&apos;s on its way to the kitchen.
        </p>
      )}

      {confirmError && (
        <p className="px-4 py-1.5 text-center text-xs font-medium text-[#e27468] sm:px-6">
          {confirmError}
        </p>
      )}

      {infoMessage && (
        <p
          className="px-4 py-1.5 text-center text-xs font-medium sm:px-6"
          style={{ color: "var(--device-lcd-cyan)" }}
        >
          {infoMessage}
        </p>
      )}

      {bill && (
        <div
          className="mx-1 mt-2 flex items-center justify-between rounded-md border px-3 py-2 text-xs sm:mx-2"
          style={{
            borderColor: "var(--device-shell-border)",
            background: "var(--device-lcd-bg)",
          }}
        >
          <span style={{ color: "var(--device-lcd-muted)" }}>
            Bill #{bill.billId}
          </span>

          <span
            className="font-semibold"
            style={{ color: "var(--device-gold)" }}
          >
            {bill.status === "paid"
              ? "PAID"
              : `Balance ₹${bill.remainingRupees.toLocaleString("en-IN")}`}
          </span>
        </div>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <KeypadPanel
          selectedItemName={selectedItem?.name ?? null}
          qtyDraft={qtyDraft}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onCommitQty={handleCommitQty}
          onQtyPlus={handleQtyPlus}
          onQtyMinus={handleQtyMinus}
          onConfirmOrder={handleConfirmOrder}
          confirmDisabled={
            cart.lines.length === 0 || confirmSubmitting
          }
          confirmSubmitting={confirmSubmitting}
          onBillGen={handleBillGen}
          onQrGen={handleQrGen}
          onClearAll={handleClearAll}
          onCallWaiter={handleCallWaiter}
          waiterCalling={waiterCalling}
          onFeedback={handleFeedback}
        />

        <OrderPanel
          tableLabel={tableLabel}
          lines={cart.lines}
          itemCount={cart.itemCount}
          totalRupees={cart.totalRupees}
        />
      </div>

      {paymentPanelOpen && (
        <PaymentPanel
          bill={bill}
          mode={paymentPanelMode}
          onClose={() => setPaymentPanelOpen(false)}
          onGenerateBill={handleBillGen}
          generatingBill={generatingBill}
          onConfirmUpi={handleConfirmUpi}
          confirmingUpi={confirmingUpi}
        />
      )}
    </div>
  );
}