"use client";

import type { ReactNode } from "react";

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

function GoldButton({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md py-2 text-[11px] font-semibold uppercase tracking-wide text-[#171a10] transition-transform active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
      style={{
        background: "linear-gradient(180deg, var(--device-gold-hover), var(--device-gold-soft))",
      }}
    >
      {children}
    </button>
  );
}

export function KeypadPanel({
  selectedItemName,
  qtyDraft,
  onDigit,
  onBackspace,
  onCommitQty,
  onQtyPlus,
  onQtyMinus,
  onConfirmOrder,
  confirmDisabled,
  confirmSubmitting,
  onBillGen,
  onQrGen,
  onClearAll,
  onCallWaiter,
  waiterCalling,
  onFeedback,
}: {
  selectedItemName: string | null;
  qtyDraft: number;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onCommitQty: () => void;
  onQtyPlus: () => void;
  onQtyMinus: () => void;
  onConfirmOrder: () => void;
  confirmDisabled: boolean;
  confirmSubmitting: boolean;
  onBillGen: () => void;
  onQrGen: () => void;
  onClearAll: () => void;
  onCallWaiter: () => void;
  waiterCalling: boolean;
  onFeedback: () => void;
}) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ background: "var(--device-shell)", borderColor: "var(--device-shell-border)" }}
    >
      <p
        className="mb-2 truncate text-[11px]"
        style={{ color: selectedItemName ? "var(--device-gold)" : "var(--device-lcd-muted)" }}
      >
        {selectedItemName
          ? `Selected: ${selectedItemName} — qty ${qtyDraft}`
          : "Tap an item above to set its quantity"}
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[auto_1fr]">
        <div className="grid w-full grid-cols-3 gap-1.5 sm:w-40">
          {DIGIT_ROWS.flat().map((digit) => (
            <GoldButton key={digit} onClick={() => onDigit(digit)}>
              {digit}
            </GoldButton>
          ))}

          <GoldButton onClick={onBackspace} ariaLabel="Backspace">
            ⌫
          </GoldButton>

          <GoldButton onClick={() => onDigit("0")}>0</GoldButton>

          <GoldButton onClick={onCommitQty} ariaLabel="Confirm quantity for selected item">
            ✓
          </GoldButton>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <GoldButton onClick={onConfirmOrder} disabled={confirmDisabled}>
            {confirmSubmitting ? "…" : "Confirm Order"}
          </GoldButton>

          <GoldButton onClick={onBillGen}>
            Bill Gen
          </GoldButton>

          <GoldButton onClick={onCallWaiter} disabled={waiterCalling}>
            {waiterCalling ? "Calling…" : "Call Waiter"}
          </GoldButton>

          <GoldButton onClick={onQrGen}>
            QR Gen
          </GoldButton>

          <GoldButton onClick={onClearAll}>
            Clear All
          </GoldButton>

          <GoldButton onClick={onFeedback}>
            Feedback
          </GoldButton>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-3">
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--device-lcd-muted)" }}
        >
          QTY
        </span>

        <GoldButton onClick={onQtyPlus} ariaLabel="Increase quantity">
          +
        </GoldButton>

        <span
          className="min-w-6 text-center text-sm font-bold"
          style={{ color: "var(--device-gold)" }}
        >
          {qtyDraft}
        </span>

        <GoldButton onClick={onQtyMinus} ariaLabel="Decrease quantity">
          −
        </GoldButton>
      </div>
    </div>
  );
}
