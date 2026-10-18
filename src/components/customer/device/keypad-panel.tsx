"use client";

import type { ReactNode } from "react";

const DIGIT_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

/* ------------------------------------------------------------------ */
/* Icons (inline SVG, no extra packages needed)                        */
/* ------------------------------------------------------------------ */

type IconName = "bell" | "bill" | "waiter" | "qr" | "clear" | "feedback";

const ICON_PATHS: Record<IconName, ReactNode> = {
  bell: (
    <>
      <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  bill: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  waiter: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21c0-4 3-6 7-6s7 2 7 6" />
    </>
  ),
  qr: (
    <>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" />
    </>
  ),
  clear: (
    <>
      <path d="M5 7h14M9 7V4h6v3" />
      <path d="M7 7l1 13h8l1-13M10 11v6M14 11v6" />
    </>
  ),
  feedback: (
    <>
      <path d="M4 5h16v11H10l-4 4v-4H4z" />
      <path d="M8 10.5h8" />
    </>
  ),
};

function Icon({ name, color }: { name: IconName; color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Keys                                                                */
/* ------------------------------------------------------------------ */

const KEY_BASE =
  "rounded-md border border-black text-white transition-transform active:translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

const BLACK_KEY_STYLE = {
  background: "linear-gradient(180deg, #2c2d31 0%, #151517 100%)",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 rgba(0,0,0,0.55)",
} as const;

function BlackKey({
  children,
  onClick,
  disabled,
  ariaLabel,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`${KEY_BASE} ${className}`}
      style={BLACK_KEY_STYLE}
    >
      {children}
    </button>
  );
}

function FunctionKey({
  icon,
  iconColor = "#ffffff",
  label,
  onClick,
  disabled,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <BlackKey
      onClick={onClick}
      disabled={disabled}
      className="flex h-full w-full items-center justify-start gap-2 px-2.5 text-[10px] font-medium uppercase tracking-wide sm:text-[11px]"
    >
      <Icon name={icon} color={iconColor} />
      <span className="truncate">{label}</span>
    </BlackKey>
  );
}

function ArrowKey({
  direction,
  onClick,
}: {
  direction: "up" | "down";
  onClick: () => void;
}) {
  const isUp = direction === "up";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isUp ? "Previous menu page" : "Next menu page"}
      className="flex h-[2.75rem] w-[2.75rem] items-center justify-center rounded-full border border-black text-white transition-transform active:scale-95"
      style={{
        background: isUp
          ? "radial-gradient(circle at 35% 30%, #3fd06a, #14803a)"
          : "radial-gradient(circle at 35% 30%, #ef5a5a, #a01616)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.5)",
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {isUp ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function KeypadPanel({
  selectedItemName,
  codeDraft,
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
  onArrowUp,
  onArrowDown,
}: {
  selectedItemName: string | null;
  codeDraft: string;
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
  onArrowUp: () => void;
  onArrowDown: () => void;
}) {
  const ROWS = "grid-rows-[repeat(4,2.75rem)]";

  return (
    <div
      className="rounded-lg border px-3 py-3 sm:px-4"
      style={{
        background:
          "linear-gradient(180deg, #d9dbdf 0%, #b9bcc2 55%, #cfd1d5 100%)",
        borderColor: "#8d9097",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      {/* Entry readout: shows the item code being typed, then the selected item */}
      <div
        className="mb-2 flex items-center justify-between rounded-md border border-black px-3 py-1.5"
        style={{ background: "#0b0d10" }}
      >
        <span
          className="truncate text-[11px]"
          style={{ color: selectedItemName ? "#d4af37" : "#8fa3b3" }}
        >
          {selectedItemName
            ? `${selectedItemName} — press ✓ to add`
            : "Enter item code, then press ✓"}
        </span>

        <span
          className="ml-3 shrink-0 font-mono text-sm font-bold"
          style={{ color: "#35d0ff" }}
        >
          {selectedItemName ? `Qty ${qtyDraft}` : codeDraft.padEnd(3, "_")}
        </span>
      </div>

      {/* Same arrangement as the real device:
          left  = number pad (3 x 4)
          right = function keys (2 x 3) + QTY bar and arrows on the 4th row */}
      <div className="mx-auto grid max-w-[32rem] grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-2">
        {/* Number pad */}
        <div className={`grid grid-cols-3 gap-1.5 ${ROWS}`}>
          {DIGIT_ROWS.flat().map((digit) => (
            <BlackKey
              key={digit}
              onClick={() => onDigit(digit)}
              className="h-full w-full text-lg font-medium"
            >
              {digit}
            </BlackKey>
          ))}

          <BlackKey
            onClick={onBackspace}
            ariaLabel="Backspace"
            className="h-full w-full text-lg font-medium"
          >
            X
          </BlackKey>

          <BlackKey
            onClick={() => onDigit("0")}
            className="h-full w-full text-lg font-medium"
          >
            0
          </BlackKey>

          <button
            type="button"
            onClick={onCommitQty}
            aria-label="Confirm quantity for selected item"
            className="flex h-full w-full items-center justify-center rounded-md border border-black text-white transition-transform active:translate-y-px active:scale-[0.97]"
            style={{
              background: "linear-gradient(180deg, #3fc062 0%, #1b8a3c 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 0 rgba(0,0,0,0.55)",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </button>
        </div>

        {/* Function keys + QTY bar + arrows */}
        <div className={`grid grid-cols-2 gap-1.5 ${ROWS}`}>
          <FunctionKey
            icon="bell"
            iconColor="#f5a623"
            label={confirmSubmitting ? "…" : "Confirm Order"}
            onClick={onConfirmOrder}
            disabled={confirmDisabled}
          />

          <FunctionKey icon="bill" label="Bill Gen" onClick={onBillGen} />

          <FunctionKey
            icon="waiter"
            label={waiterCalling ? "Calling…" : "Call Waiter"}
            onClick={onCallWaiter}
            disabled={waiterCalling}
          />

          <FunctionKey
            icon="qr"
            iconColor="#f5a623"
            label="QR Gen"
            onClick={onQrGen}
          />

          <FunctionKey icon="clear" label="Clear All" onClick={onClearAll} />

          <FunctionKey icon="feedback" label="Feedback" onClick={onFeedback} />

          {/* 4th row: − QTY +  and  ↑ ↓ */}
          <div className="col-span-2 flex items-center justify-between gap-2">
            <div className="flex h-full flex-1 items-stretch gap-1">
              <BlackKey
                onClick={onQtyMinus}
                ariaLabel="Decrease quantity"
                className="w-9 text-lg font-medium"
              >
                −
              </BlackKey>

              <div
                className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-md border border-black text-white"
                style={BLACK_KEY_STYLE}
              >
                <span className="text-[9px] font-medium uppercase tracking-widest text-[#c9ccd2]">
                  Qty
                </span>
                <span className="text-sm font-bold leading-none">
                  {qtyDraft}
                </span>
              </div>

              <BlackKey
                onClick={onQtyPlus}
                ariaLabel="Increase quantity"
                className="w-9 text-lg font-medium"
              >
                +
              </BlackKey>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowKey direction="up" onClick={onArrowUp} />
              <ArrowKey direction="down" onClick={onArrowDown} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}