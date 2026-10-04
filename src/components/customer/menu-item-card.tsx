"use client";

import type { MenuItem } from "@/server/modules/demo-store/store";
import { getEffectivePrice } from "@/lib/menu-shared";
import { useCartOptional } from "./cart-context";

/**
 * Display of a single menu item.
 *
 * Unavailable items are visually and semantically distinct: they show
 * "Unavailable" in the error color and never show a price as if it
 * were free, and they never get an add-to-cart control (Step 3).
 *
 * On the untabled /customer/menu route (no CartProvider present),
 * useCartOptional() returns null and this renders exactly as it did
 * before Step 3 — plain read-only card, no button.
 */
export function MenuItemCard({ item }: { item: MenuItem }) {
  const isAvailable = item.available;
  const cart = useCartOptional();
  const qty = cart?.getQty(item.code) ?? 0;
  const effectivePrice = getEffectivePrice(item);
  const hasDiscount = item.discountPercent > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isAvailable
          ? "border-[var(--tablor-border)] bg-[var(--tablor-card)]"
          : "border-[var(--tablor-border)] bg-[var(--tablor-card)] opacity-60"
      }`}
    >
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- served by our own /api/menu-image route
        <img
          src={item.imageUrl}
          alt={item.name}
          loading="lazy"
          className="mb-3 h-36 w-full rounded-lg object-cover"
        />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <VegIndicator veg={item.veg} />
            <h3 className="truncate text-base font-medium text-[var(--tablor-text-primary)]">
              {item.name}
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--tablor-text-muted)]">
            Code #{item.code} &middot; {item.category}
          </p>
          {item.description && (
            <p className="mt-1.5 text-xs text-[var(--tablor-text-secondary)]">
              {item.description}
            </p>
          )}
          {isAvailable && (item.isSpecial || hasDiscount) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.isSpecial && (
                <span className="rounded-full border border-[var(--tablor-accent)]/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--tablor-accent)]">
                  Today&apos;s special
                </span>
              )}
              {hasDiscount && (
                <span className="rounded-full border border-[var(--tablor-accent)]/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--tablor-accent)]">
                  {item.discountPercent}% off
                </span>
              )}
            </div>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${
            isAvailable
              ? "bg-[var(--tablor-icon-surface)] text-[var(--tablor-accent)]"
              : "bg-[var(--tablor-icon-surface)] text-[var(--tablor-error)]"
          }`}
        >
          {isAvailable ? "Available" : "Unavailable"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          {isAvailable ? (
            <p className="text-lg font-semibold text-[var(--tablor-text-primary)]">
              {hasDiscount && (
                <s className="mr-2 text-sm font-normal text-[var(--tablor-text-muted)]">
                  ₹{item.priceRupees}
                </s>
              )}
              ₹{effectivePrice}
            </p>
          ) : (
            <p className="text-sm font-medium text-[var(--tablor-error)]">
              Currently unavailable
            </p>
          )}
          <p className="mt-0.5 text-xs text-[var(--tablor-text-secondary)]">
            Prep time: {item.prepMinutes} min
          </p>
        </div>

        {isAvailable && cart ? (
          qty === 0 ? (
            <button
              type="button"
              onClick={() => cart.addItem(item)}
              className="shrink-0 rounded-full border border-[var(--tablor-accent)] bg-[var(--tablor-accent)] px-4 py-2 text-sm font-medium text-[#0d0e0b] transition-colors active:scale-[0.97]"
            >
              Add
            </button>
          ) : (
            <div className="flex shrink-0 items-center gap-3 rounded-full border border-[var(--tablor-accent)] bg-[var(--tablor-icon-surface)] px-1 py-1">
              <button
                type="button"
                aria-label={`Decrease quantity of ${item.name}`}
                onClick={() => cart.decrement(item.code)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tablor-accent)] active:scale-[0.9]"
              >
                −
              </button>
              <span className="min-w-4 text-center text-sm font-medium text-[var(--tablor-text-primary)]">
                {qty}
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${item.name}`}
                onClick={() => cart.increment(item.code)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tablor-accent)] active:scale-[0.9]"
              >
                +
              </button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function VegIndicator({ veg }: { veg: boolean }) {
  return (
    <span
      aria-label={veg ? "Vegetarian" : "Non-vegetarian"}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
        veg ? "border-[var(--tablor-accent)]" : "border-[var(--tablor-error)]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          veg ? "bg-[var(--tablor-accent)]" : "bg-[var(--tablor-error)]"
        }`}
      />
    </span>
  );
}