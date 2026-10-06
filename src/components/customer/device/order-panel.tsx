"use client";

import type { CartLine } from "@/components/customer/cart-context";

export function OrderPanel({
  tableLabel,
  lines,
  itemCount,
  totalRupees,
}: {
  tableLabel: string;
  lines: CartLine[];
  itemCount: number;
  totalRupees: number;
}) {
  return (
    <div
      className="flex h-full flex-col rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3"
      style={{ background: "var(--device-lcd-bg)", borderColor: "var(--device-lcd-border)" }}
    >
      <div className="flex items-center justify-between">
        <h2
          className="text-xs font-bold uppercase tracking-wide sm:text-sm"
          style={{ color: "var(--device-lcd-cyan)" }}
        >
          Your Order
        </h2>
        <span
          className="rounded px-2 py-0.5 text-[11px] font-bold"
          style={{ background: "var(--device-gold)", color: "#171a10" }}
        >
          Table No: {tableLabel}
        </span>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <p className="py-6 text-center text-xs" style={{ color: "var(--device-lcd-muted)" }}>
            No items added yet. Select from the menu above.
          </p>
        ) : (
          <table className="w-full text-[12px]" style={{ color: "var(--device-lcd-text)" }}>
            <thead>
              <tr style={{ color: "var(--device-lcd-muted)" }}>
                <th className="w-6 pb-1 text-left font-normal">Sno</th>
                <th className="pb-1 text-left font-normal">Code</th>
                <th className="pb-1 text-left font-normal">Item name</th>
                <th className="pb-1 text-right font-normal">Qty</th>
                <th className="pb-1 text-right font-normal">Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.code} className="border-t" style={{ borderColor: "var(--device-lcd-border)" }}>
                  <td className="py-1">{index + 1}.</td>
                  <td className="py-1">{line.code}</td>
                  <td className="truncate py-1">{line.name}</td>
                  <td className="py-1 text-right">{line.qty}</td>
                  <td className="py-1 text-right">
                    {line.priceRupees * line.qty}/-
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        className="mt-2 flex items-center justify-between border-t pt-2 text-[12px] sm:text-sm"
        style={{ borderColor: "var(--device-lcd-border)" }}
      >
        <span style={{ color: "var(--device-lcd-cyan)" }} className="font-semibold">
          Total Items : {itemCount}
        </span>
        <span style={{ color: "var(--device-lcd-cyan)" }} className="font-semibold">
          Total : ₹ {totalRupees}/-
        </span>
      </div>

      <p
        className="mt-1.5 text-center text-[10px] uppercase tracking-widest"
        style={{ color: "var(--device-lcd-muted)" }}
      >
        TFT LCD Display
      </p>
    </div>
  );
}
