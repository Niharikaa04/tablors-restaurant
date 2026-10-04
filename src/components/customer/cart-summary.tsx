"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCart } from "./cart-context";
import {
  checkOrderPaymentStatus,
  placeCustomerOrder,
} from "@/server/modules/orders/actions";

export function CartSummary({ tableId }: { tableId: string }) {
  const cart = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Seed from ?order= so a reload while waiting on payment keeps polling
  // the same exact order instead of losing track of it.
  const [lastOrderId, setLastOrderId] = useState<string | null>(
    () => searchParams.get("order")
  );

  // If the customer starts a fresh cart after a confirmed order, drop
  // the old confirmation so it doesn't linger.
  const [prevLinesLength, setPrevLinesLength] = useState(cart.lines.length);

  if (cart.lines.length !== prevLinesLength) {
    setPrevLinesLength(cart.lines.length);

    if (cart.lines.length > 0 && lastOrderId) {
      setLastOrderId(null);
    }
  }

  // Check payment status of the exact order every 4 seconds.
  // Once payment is detected, refresh the server-rendered page
  // so the completed-order / feedback state can appear.
  useEffect(() => {
    if (cart.lines.length !== 0 || !lastOrderId) return;

    const orderId = lastOrderId;

    const interval = setInterval(async () => {
      const status = await checkOrderPaymentStatus(orderId);

      if (status.paid) {
        router.refresh();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [cart.lines.length, lastOrderId, router]);

  async function handlePlaceOrder() {
    setSubmitting(true);
    setErrorMsg(null);

    const result = await placeCustomerOrder({
      tableId,
      lines: cart.lines.map((line) => ({
        code: line.code,
        itemId: line.itemId,
        qty: line.qty,
      })),
    });

    setSubmitting(false);

    if (result.ok) {
      cart.clearCart();
      setLastOrderId(result.orderId);
      // Put the exact orderId in the URL so the server-rendered page
      // (and a page reload) can look up THIS order's bill/feedback state
      // instead of guessing from the table.
      router.replace(`${pathname}?order=${result.orderId}`);
    } else {
      setErrorMsg(result.error);
    }
  }

  if (cart.lines.length === 0) {
    if (lastOrderId) {
      return (
        <div className="rounded-2xl border border-[var(--tablor-accent)] bg-[var(--tablor-card)] px-4 py-5 text-center">
          <p className="text-sm font-medium text-[var(--tablor-accent)]">
            Order placed — #{lastOrderId}
          </p>

          <p className="mt-1 text-xs text-[var(--tablor-text-muted)]">
            It&apos;s on its way to the kitchen. You can keep browsing and add
            another order any time.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] px-4 py-5 text-center">
        <p className="text-sm text-[var(--tablor-text-muted)]">
          Your cart is empty. Add items from the menu above.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] p-4">
      <h2 className="text-base font-semibold text-[var(--tablor-text-primary)]">
        Your cart
      </h2>

      <div className="mt-3 divide-y divide-[var(--tablor-border)]">
        {cart.lines.map((line) => (
          <div key={line.code} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--tablor-text-primary)]">
                {line.name}
              </p>

              <p className="mt-0.5 text-xs text-[var(--tablor-text-muted)]">
                Code #{line.code} &middot; ₹{line.priceRupees} &times;{" "}
                {line.qty}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--tablor-accent)] bg-[var(--tablor-icon-surface)] px-1 py-1">
              <button
                type="button"
                aria-label={`Decrease quantity of ${line.name}`}
                onClick={() => cart.decrement(line.code)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tablor-accent)] active:scale-[0.9]"
              >
                −
              </button>

              <span className="min-w-4 text-center text-sm font-medium text-[var(--tablor-text-primary)]">
                {line.qty}
              </span>

              <button
                type="button"
                aria-label={`Increase quantity of ${line.name}`}
                onClick={() => cart.increment(line.code)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--tablor-accent)] active:scale-[0.9]"
              >
                +
              </button>
            </div>

            <p className="w-16 shrink-0 text-right text-sm font-semibold text-[var(--tablor-text-primary)]">
              ₹{line.priceRupees * line.qty}
            </p>

            <button
              type="button"
              aria-label={`Remove ${line.name} from cart`}
              onClick={() => cart.removeItem(line.code)}
              className="shrink-0 text-xs font-medium text-[var(--tablor-error)]"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1 border-t border-[var(--tablor-border)] pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--tablor-text-secondary)]">
            Subtotal
          </span>

          <span className="text-[var(--tablor-text-primary)]">
            ₹{cart.subtotalRupees}
          </span>
        </div>

        <div className="flex items-center justify-between text-base font-semibold">
          <span className="text-[var(--tablor-text-primary)]">Total</span>

          <span className="text-[var(--tablor-accent)]">
            ₹{cart.totalRupees}
          </span>
        </div>
      </div>

      {errorMsg && (
        <p className="mt-3 text-sm font-medium text-[var(--tablor-error)]">
          {errorMsg}
        </p>
      )}

      <button
        type="button"
        onClick={handlePlaceOrder}
        disabled={submitting}
        className="mt-4 w-full rounded-full bg-[var(--tablor-accent)] py-3 text-sm font-semibold text-[#0d0e0b] transition-opacity active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}