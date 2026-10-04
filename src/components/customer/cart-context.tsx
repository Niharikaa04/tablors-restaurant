"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import { getEffectivePrice } from "@/lib/menu-shared";

/**
 * Customer cart state.
 *
 * Holds cart lines in memory for the current table session.
 */

export type CartLine = {
  /** Stable MenuItem.id — lets checkout survive an owner code edit. */
  itemId: string;
  code: string;
  name: string;
  priceRupees: number;
  qty: number;
};

type CartContextValue = {
  lines: CartLine[];
  addItem: (item: MenuItem) => void;
  increment: (code: string) => void;
  decrement: (code: string) => void;
  removeItem: (code: string) => void;
  clearCart: () => void;
  getQty: (code: string) => number;
  /**
   * Set a line to an exact quantity (used by the device keypad: type a
   * number, hit confirm). qty <= 0 removes the line. Unlike addItem,
   * this creates a line from a bare MenuItem+qty pair.
   */
  setQty: (item: MenuItem, qty: number) => void;
  /**
   * Reconciles the cart with the latest canonical menu: drops lines whose
   * item is now unavailable/removed and refreshes name/code/price. The
   * server still revalidates everything at checkout — this just keeps the
   * on-screen cart honest.
   */
  syncWithMenu: (items: MenuItem[]) => void;
  itemCount: number;
  subtotalRupees: number;
  totalRupees: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const addItem = useCallback((item: MenuItem) => {
    // Unavailable items can never enter the cart, regardless of caller.
    if (!item.available) return;

    setLines((prev) => {
      const existing = prev.find((line) => line.itemId === item.id);
      if (existing) {
        return prev.map((line) =>
          line.itemId === item.id ? { ...line, qty: line.qty + 1 } : line
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          code: item.code,
          name: item.name,
          priceRupees: getEffectivePrice(item),
          qty: 1,
        },
      ];
    });
  }, []);

  const increment = useCallback((code: string) => {
    setLines((prev) =>
      prev.map((line) =>
        line.code === code ? { ...line, qty: line.qty + 1 } : line
      )
    );
  }, []);

  const decrement = useCallback((code: string) => {
    setLines((prev) =>
      prev
        .map((line) =>
          line.code === code ? { ...line, qty: line.qty - 1 } : line
        )
        .filter((line) => line.qty > 0)
    );
  }, []);

  const removeItem = useCallback((code: string) => {
    setLines((prev) => prev.filter((line) => line.code !== code));
  }, []);

  const setQty = useCallback((item: MenuItem, qty: number) => {
    if (!item.available) return;

    setLines((prev) => {
      if (qty <= 0) {
        return prev.filter((line) => line.itemId !== item.id);
      }

      const existing = prev.find((line) => line.itemId === item.id);
      if (existing) {
        return prev.map((line) =>
          line.itemId === item.id ? { ...line, qty } : line
        );
      }

      return [
        ...prev,
        {
          itemId: item.id,
          code: item.code,
          name: item.name,
          priceRupees: getEffectivePrice(item),
          qty,
        },
      ];
    });
  }, []);

  const syncWithMenu = useCallback((items: MenuItem[]) => {
    setLines((prev) => {
      let changed = false;
      const next: CartLine[] = [];
      for (const line of prev) {
        const item = items.find((m) => m.id === line.itemId);
        if (!item || !item.available) {
          changed = true;
          continue;
        }
        const price = getEffectivePrice(item);
        if (price !== line.priceRupees || item.name !== line.name || item.code !== line.code) {
          changed = true;
          next.push({ ...line, name: item.name, code: item.code, priceRupees: price });
        } else {
          next.push(line);
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
  }, []);

  const getQty = useCallback(
    (code: string) => lines.find((line) => line.code === code)?.qty ?? 0,
    [lines]
  );

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty, 0),
    [lines]
  );

  const subtotalRupees = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.priceRupees, 0),
    [lines]
  );

  // Kept separate from subtotal on purpose: taxes/charges are a billing
  // concern (see owner/billing) and are not decided in this feature.
  // For now the cart total equals the subtotal.
  const totalRupees = subtotalRupees;

  const value: CartContextValue = {
    lines,
    addItem,
    increment,
    decrement,
    removeItem,
    clearCart,
    getQty,
    setQty,
    syncWithMenu,
    itemCount,
    subtotalRupees,
    totalRupees,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}

/**
 * Same as useCart(), but returns null instead of throwing when there's
 * no CartProvider above in the tree. Needed because MenuItemCard is
 * shared with the untabled /customer/menu route, which intentionally
 * has no CartProvider and must keep behaving exactly as before —
 * read-only, no add-to-cart control.
 */
export function useCartOptional() {
  return useContext(CartContext);
}