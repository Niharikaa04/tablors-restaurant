"use client";

import { useState } from "react";
import Link from "next/link";
import type { getOrdersByCategory } from "@/server/modules/demo-store/store";

type CategorySlice = ReturnType<typeof getOrdersByCategory>[number];

// A fixed, repeating palette so category color stays stable regardless
// of which categories exist in the data — no per-category color logic
// tied to invented meaning.
const SLICE_COLORS = [
  "var(--ov-accent)",
  "var(--ov-gold)",
  "#8b7cf6",
  "#e2857a",
  "#4fb4ff",
  "#f5c451",
  "#9da194",
];

const SIZE = 160;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function OrdersByCategoryChart({ categories }: { categories: CategorySlice[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const totalOrders = categories.reduce((sum, c) => sum + c.orders, 0);

  let cumulative = 0;
  const slices = categories.map((c, i) => {
    const fraction = totalOrders > 0 ? c.orders / totalOrders : 0;
    const dash = fraction * CIRCUMFERENCE;
    const offset = cumulative;
    cumulative += dash;
    return {
      ...c,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      dash,
      offset,
      percent: Math.round(fraction * 100),
    };
  });

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ov-text)]">Orders by Category</h2>
          <p className="mt-0.5 text-xs text-[var(--ov-muted)]">By menu category, today</p>
        </div>
        <span className="rounded-md border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ov-text-secondary)]">
          Today
        </span>
      </div>

      {totalOrders === 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--ov-muted)]">No orders placed yet today.</p>
      ) : (
        <>
          <div className="mt-4 flex justify-center">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="h-40 w-40 -rotate-90"
              role="img"
              aria-label="Orders by category donut chart"
              onMouseLeave={() => setActiveIndex(null)}
            >
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--ov-border)"
                strokeWidth={STROKE}
              />
              {slices.map((slice, i) => (
                <circle
                  key={slice.category}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={activeIndex === i ? STROKE + 4 : STROKE}
                  strokeDasharray={`${slice.dash} ${CIRCUMFERENCE - slice.dash}`}
                  strokeDashoffset={-slice.offset}
                  className="cursor-pointer transition-[stroke-width] duration-150"
                  onMouseEnter={() => setActiveIndex(i)}
                  onFocus={() => setActiveIndex(i)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${slice.category}: ${slice.orders} orders, ${slice.percent} percent`}
                />
              ))}
            </svg>
          </div>
          <div className="-mt-[6.5rem] flex justify-center">
            <div className="pointer-events-none text-center">
              <p className="text-2xl font-bold text-[var(--ov-text)]">
                {activeIndex !== null ? slices[activeIndex].orders : totalOrders}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-[var(--ov-muted)]">
                {activeIndex !== null ? slices[activeIndex].category : "Orders"}
              </p>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {slices.map((slice, i) => (
              <li key={slice.category}>
                <Link
                  href={`/owner/menu?category=${encodeURIComponent(slice.category)}`}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-[var(--ov-icon-surface)] ${
                    activeIndex === i ? "bg-[var(--ov-icon-surface)]" : ""
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: slice.color }}
                    />
                    <span className="truncate text-[var(--ov-text-secondary)]">{slice.category}</span>
                  </span>
                  <span className="shrink-0 text-[var(--ov-text)]">
                    {slice.orders} <span className="text-[var(--ov-muted)]">({slice.percent}%)</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
