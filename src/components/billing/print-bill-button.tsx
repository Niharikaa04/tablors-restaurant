"use client";

export function PrintBillButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-4 py-2 text-xs font-medium text-[#0a0a0a]"
    >
      Print bill
    </button>
  );
}