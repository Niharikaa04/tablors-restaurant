"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

import type { MenuItem } from "@/server/modules/demo-store/store";
import { useCart } from "./cart-context";
import { MenuPane } from "./device/menu-pane";
import { KeypadPanel } from "./device/keypad-panel";
import { OrderPanel } from "./device/order-panel";
import { PaymentPanel } from "./device/payment-panel";
import { OrderCompletedPanel } from "./order-completed-panel";

import {
  callWaiter,
  placeCustomerOrder,
} from "@/server/modules/orders/actions";

import {
  generateCustomerBill,
  getCustomerOrderState,
  recordCustomerUpiPayment,
  identifyLoyaltyMember,
  redeemLoyaltyReward,
  removeLoyaltyReward,
  type CustomerBillState,
} from "@/server/modules/customer/actions";

const MAX_QTY = 99;
const MAX_CODE_LEN = 4;
const MENU_REFRESH_MS = 10_000;
const PAYMENT_REFRESH_MS = 2_000;

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

  /*
   * Item selection works like the real device:
   *  1. Type the item code on the keypad (codeDraft)
   *  2. Press ✓  -> the item is selected (selectedCode)
   *  3. Type the quantity (or use + / -)
   *  4. Press ✓  -> the item is added to the order
   */
  const [codeDraft, setCodeDraft] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [qtyDraft, setQtyDraft] = useState(0);
  const [qtyTyped, setQtyTyped] = useState(false);

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
  const confirmInFlight = useRef(false);

  // Menu pages (one category per page), driven by the keypad ▲ ▼ arrows and
  // the keyboard ArrowUp/ArrowDown keys. Wraps around, so never disabled.
  const [menuPage, setMenuPage] = useState(0);
  const menuPageCount = Math.max(new Set(items.map((i) => i.category)).size, 1);

  function stepMenuPage(delta: number) {
    setMenuPage((prev) => (prev + delta + menuPageCount) % menuPageCount);
  }

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

      // The completed/feedback view is rendered right away from this state;
      // the refresh only brings the server-rendered page in line afterwards.
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

  /*
   * Number keys:
   *  - no item selected yet -> build the item code
   *  - item selected        -> build the quantity
   */
  function handleDigit(digit: string) {
    if (!selectedItem) {
      setConfirmError(null);
      setCodeDraft((prev) =>
        prev.length >= MAX_CODE_LEN ? prev : prev + digit
      );
      return;
    }

    setQtyDraft((prev) => {
      // The first digit typed replaces the default quantity.
      if (!qtyTyped) {
        return Number(digit);
      }

      const next = Number(`${prev === 0 ? "" : prev}${digit}`);

      return Number.isFinite(next) ? Math.min(next, MAX_QTY) : prev;
    });

    setQtyTyped(true);
  }

  /*
   * X key: delete the last code digit, or the last quantity digit.
   */
  function handleBackspace() {
    if (!selectedItem) {
      setCodeDraft((prev) => prev.slice(0, -1));
      return;
    }

    setQtyDraft((prev) => Math.floor(prev / 10));
    setQtyTyped(true);
  }

  /*
   * ✓ key:
   *  - no item selected -> look up the typed item code and select it
   *  - item selected    -> add the item with the chosen quantity
   */
  function handleCommitQty() {
    if (!selectedItem) {
      const code = codeDraft.trim();

      if (!code) {
        setInfoMessage("Enter an item code first, then press ✓.");
        return;
      }

      const match =
        items.find((item) => item.code === code) ??
        items.find((item) => item.code === code.padStart(3, "0"));

      if (!match) {
        setInfoMessage(`No item found with code ${code}.`);
        setCodeDraft("");
        return;
      }

      setSelectedCode(match.code);
      setQtyDraft(cart.getQty(match.code) || 1);
      setQtyTyped(false);
      setCodeDraft("");
      setConfirmError(null);
      return;
    }

    cart.setQty(selectedItem, qtyDraft);
    setSelectedCode(null);
    setQtyDraft(0);
    setQtyTyped(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      event.preventDefault();
      setMenuPage((prev) =>
        (prev + (event.key === "ArrowUp" ? -1 : 1) + menuPageCount) % menuPageCount
      );
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuPageCount]);

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
    setCodeDraft("");
    setSelectedCode(null);
    setQtyDraft(0);
    setQtyTyped(false);
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
      setCodeDraft("");
      setSelectedCode(null);
      setQtyDraft(0);
      setQtyTyped(false);
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
    // The ref blocks a second click in the same tick, before state re-renders.
    if (!lastOrderId || confirmInFlight.current) {
      return;
    }

    confirmInFlight.current = true;
    setConfirmingUpi(true);
    setConfirmError(null);

    let result: Awaited<ReturnType<typeof recordCustomerUpiPayment>>;

    try {
      result = await recordCustomerUpiPayment(
        tableId,
        lastOrderId,
        transactionId
      );
    } finally {
      confirmInFlight.current = false;
      setConfirmingUpi(false);
    }

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

  // Loyalty: each call returns the refreshed bill (new total after a reward).
  const loyaltyHandlers = {
    async identify(phone: string) {
      if (!lastOrderId) return { ok: false, message: "Generate the bill first." };
      const res = await identifyLoyaltyMember(tableId, lastOrderId, phone);
      if (res.bill) setBill(res.bill);
      return res.ok ? { ok: true } : { ok: false, message: res.message };
    },
    async redeem(rewardId: string) {
      if (!lastOrderId) return { ok: false, message: "Generate the bill first." };
      const res = await redeemLoyaltyReward(tableId, lastOrderId, rewardId);
      if (res.bill) setBill(res.bill);
      return res.ok ? { ok: true } : { ok: false, message: res.message };
    },
    async remove() {
      if (!lastOrderId) return { ok: false, message: "Generate the bill first." };
      const res = await removeLoyaltyReward(tableId, lastOrderId);
      if (res.bill) setBill(res.bill);
      return res.ok ? { ok: true } : { ok: false, message: res.message };
    },
  };

  // Show the thank-you + feedback form the moment the bill is paid, without
  // waiting for a full server re-render of the page.
  if (bill?.status === "paid" && lastOrderId) {
    return (
      <div className="mt-2">
        <OrderCompletedPanel
          orderId={lastOrderId}
          tableId={tableId}
          feedbackSubmitted={false}
        />
      </div>
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

      {/*
        Items are chosen by typing their code on the keypad,
        so tapping a menu row does nothing.
        To allow tapping again, pass a handler that sets
        selectedCode / qtyDraft here instead of the empty function.
      */}
      <MenuPane
        items={items}
        selectedCode={selectedCode}
        onSelectItem={() => {}}
        getQty={cart.getQty}
        pageIndex={menuPage}
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
          codeDraft={codeDraft}
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
          onArrowUp={() => stepMenuPage(-1)}
          onArrowDown={() => stepMenuPage(1)}
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
          loyalty={loyaltyHandlers}
        />
      )}
    </div>
  );
}