"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { getOrdersByHourWindow } from "@/server/modules/demo-store/store";

type HourPoint = ReturnType<typeof getOrdersByHourWindow>[number];

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

export function SalesChart({ points }: { points: HourPoint[] }) {
  const router = useRouter();
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const hasAnyOrders = points.some((p) => p.grossValueRupees > 0);
  const maxValue = Math.max(1, ...points.map((p) => p.grossValueRupees));
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;

  const coords = points.map((p, i) => ({
    x: PAD_LEFT + i * step,
    y: PAD_TOP + plotHeight - (p.grossValueRupees / maxValue) * plotHeight,
    point: p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.x ?? PAD_LEFT},${PAD_TOP + plotHeight} L${PAD_LEFT},${PAD_TOP + plotHeight} Z`;

  // 4 evenly-spaced gridlines/labels along the y-axis, scaled to the real max.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxValue * f));

  const hovered = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--ov-text)]">Sales Overview</h2>
          <p className="mt-0.5 text-xs text-[var(--ov-muted)]">Gross sales by hour, live</p>
        </div>
        <span className="rounded-md border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ov-text-secondary)]">
          Today
        </span>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-48 w-full cursor-pointer"
          role="img"
          aria-label="Sales by hour, click a point to view orders"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ov-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--ov-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Y gridlines + labels, real scale */}
          {yTicks.map((tick, i) => {
            const y = PAD_TOP + plotHeight - (i / (yTicks.length - 1)) * plotHeight;
            return (
              <g key={tick + "-" + i}>
                <line
                  x1={PAD_LEFT}
                  x2={WIDTH - PAD_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="var(--ov-border)"
                  strokeWidth={1}
                />
                <text x={PAD_LEFT - 8} y={y + 3} textAnchor="end" fontSize={9} fill="var(--ov-muted)">
                  {tick >= 1000 ? `${Math.round(tick / 100) / 10}k` : tick}
                </text>
              </g>
            );
          })}

          {hasAnyOrders && (
            <>
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path d={linePath} fill="none" stroke="var(--ov-accent)" strokeWidth={2} />
            </>
          )}

          {/* X labels */}
          {coords.map((c, i) =>
            i % 2 === 0 ? (
              <text
                key={c.point.hour}
                x={c.x}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize={9}
                fill="var(--ov-muted)"
              >
                {c.point.hourLabel.replace(" ", "")}
              </text>
            ) : null
          )}

          {/* Interaction targets + point markers */}
          {coords.map((c, i) => (
            <g key={c.point.hour}>
              <rect
                x={c.x - step / 2}
                y={PAD_TOP}
                width={step}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onFocus={() => setHoverIndex(i)}
                onClick={() => router.push("/owner/orders")}
                tabIndex={0}
                role="button"
                aria-label={`${c.point.hourLabel}: ₹${c.point.grossValueRupees} across ${c.point.orders} order${c.point.orders === 1 ? "" : "s"}. View orders.`}
              />
              {c.point.grossValueRupees > 0 && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={hoverIndex === i ? 4 : 2.5}
                  fill="var(--ov-bg)"
                  stroke="var(--ov-accent)"
                  strokeWidth={2}
                />
              )}
            </g>
          ))}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--ov-border)] bg-[var(--ov-icon-surface)] px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(hovered.x / WIDTH) * 100}%`,
              top: `${(hovered.y / HEIGHT) * 100}%`,
            }}
          >
            <p className="font-semibold text-[var(--ov-text)]">{hovered.point.hourLabel}</p>
            <p className="text-[var(--ov-text-secondary)]">₹{hovered.point.grossValueRupees.toLocaleString("en-IN")}</p>
            <p className="text-[var(--ov-muted)]">
              {hovered.point.orders} order{hovered.point.orders === 1 ? "" : "s"} · click for detail
            </p>
          </div>
        )}
      </div>

      {!hasAnyOrders && (
        <p className="mt-2 text-xs text-[var(--ov-muted)]">No orders placed in this window yet.</p>
      )}
    </div>
  );
}
