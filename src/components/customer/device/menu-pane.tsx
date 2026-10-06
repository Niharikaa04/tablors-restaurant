"use client";

import { useMemo, useState } from "react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import { getEffectivePrice } from "@/lib/menu-shared";

/**
 * Top "pages" section of the Tablor's device: one category per page,
 * styled after the PDF's cream paper menu pages (red PAGE tag, black
 * numbered code badges, prev/next page nav). Categories double as
 * pages since the demo menu is small — a category with many items
 * would paginate the same way a physical page would.
 */
export function MenuPane({
  items,
  selectedCode,
  onSelectItem,
  getQty,
}: {
  items: MenuItem[];
  selectedCode: string | null;
  onSelectItem: (item: MenuItem) => void;
  getQty: (code: string) => number;
}) {
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))),
    [items]
  );

  const [pageIndex, setPageIndex] = useState(0);
  const safePageIndex = Math.min(pageIndex, Math.max(categories.length - 1, 0));
  const activeCategory = categories[safePageIndex];

  const pageItems = useMemo(
    () => items.filter((item) => item.category === activeCategory),
    [items, activeCategory]
  );

  function goTo(next: number) {
    setPageIndex(Math.max(0, Math.min(categories.length - 1, next)));
  }

  return (
    <div
      className="rounded-t-xl border-b border-[var(--device-paper-border)]"
      style={{ background: "var(--device-paper)" }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-6">
        <span
          className="shrink-0 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ background: "var(--device-tag-red)" }}
        >
          Page {safePageIndex + 1}
        </span>
        <h2
          className="truncate text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--device-paper-text)" }}
        >
          {activeCategory ?? "Menu"}
        </h2>
      </div>

      <div className="max-h-[46vh] overflow-y-auto px-4 py-3 sm:px-6">
        {pageItems.length === 0 ? (
          <p className="py-6 text-sm" style={{ color: "var(--device-paper-muted)" }}>
            No items in this category.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            {pageItems.map((item) => {
              const isSelected = item.code === selectedCode;
              const qty = getQty(item.code);

              return (
                <button
                  key={item.code}
                  type="button"
                  disabled={!item.available}
                  onClick={() => onSelectItem(item)}
                  className={`flex min-h-9 items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors ${
                    item.available ? "" : "cursor-not-allowed opacity-50"
                  }`}
                  style={{
                    background: isSelected ? "rgba(212,175,55,0.18)" : "transparent",
                    outline: isSelected ? "1px solid var(--device-gold)" : "none",
                  }}
                >
                  <span
                    className="flex h-6 w-8 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white"
                    style={{ background: "var(--device-badge)" }}
                  >
                    {item.code}
                  </span>

                  <span
                    className="min-w-0 flex-1 truncate text-[13px]"
                    style={{ color: "var(--device-paper-text)" }}
                  >
                    {item.name}
                    {item.isSpecial && (
                      <span
                        title="Today's special"
                        aria-label="Today's special"
                        className="ml-1.5 text-[11px] font-bold"
                        style={{ color: "var(--device-tag-red)" }}
                      >
                        ★
                      </span>
                    )}
                  </span>

                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{
                      background: item.veg ? "#2e8b3d" : "#b3261e",
                    }}
                  />

                  {item.available ? (
                    <span
                      className="shrink-0 text-[12px] font-medium"
                      style={{ color: "var(--device-paper-muted)" }}
                    >
                      {item.discountPercent > 0 && (
                        <s className="mr-1 text-[10px] opacity-60">₹{item.priceRupees}</s>
                      )}
                      ₹{getEffectivePrice(item)}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-medium text-[#b3261e]">
                      N/A
                    </span>
                  )}

                  {qty > 0 && (
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: "var(--device-gold-soft)" }}
                    >
                      ×{qty}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-[var(--device-paper-border)] py-2">
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => goTo(safePageIndex - 1)}
          disabled={safePageIndex === 0}
          className="text-sm font-bold disabled:opacity-30"
          style={{ color: "var(--device-paper-text)" }}
        >
          ◀
        </button>
        <span className="text-xs font-medium" style={{ color: "var(--device-paper-muted)" }}>
          Page {safePageIndex + 1} / {categories.length}
        </span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => goTo(safePageIndex + 1)}
          disabled={safePageIndex === categories.length - 1}
          className="text-sm font-bold disabled:opacity-30"
          style={{ color: "var(--device-paper-text)" }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
