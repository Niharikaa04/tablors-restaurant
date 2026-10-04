"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, UtensilsCrossed, ArrowRight } from "lucide-react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import { getEffectivePrice } from "@/lib/menu-shared";
import { AvailabilityToggle } from "./availability-toggle";

const ALL_CATEGORY = "All Items";

export function MenuAvailabilityPanel({
  menu,
  togglingCode,
  onToggleAvailability,
  canOpenFullMenu,
}: {
  menu: MenuItem[];
  togglingCode: string | null;
  onToggleAvailability: (code: string, nextAvailable: boolean) => void;
  /** "/owner/menu" is owner/admin-only — kitchen-role staff can't open
   * it, so this panel only links there for roles that actually can
   * (see requirement: kitchen users only access kitchen functionality). */
  canOpenFullMenu: boolean;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);

  const categories = useMemo(
    () => [ALL_CATEGORY, ...Array.from(new Set(menu.map((item) => item.category)))],
    [menu]
  );

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menu.filter((item) => {
      const matchesCategory = category === ALL_CATEGORY || item.category === category;
      const matchesSearch =
        query.length === 0 ||
        item.name.toLowerCase().includes(query) ||
        item.code.includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menu, category, search]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--kd-border)] bg-[var(--kd-surface)] p-4">
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-4 w-4 text-[var(--kd-accent)]" />
        <h2 className="text-sm font-semibold text-[var(--kd-text)]">Menu Items Availability</h2>
      </div>

      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((c) => {
          const isActive = c === category;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "border-[var(--kd-accent)] bg-[var(--kd-accent)] text-[var(--kd-accent-ink)]"
                  : "border-[var(--kd-border)] bg-[var(--kd-surface-raised)] text-[var(--kd-text-secondary)] hover:border-[var(--kd-accent)]/50"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--kd-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or code..."
          className="w-full rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] py-2 pl-8 pr-3 text-sm text-[var(--kd-text)] placeholder:text-[var(--kd-muted)] outline-none focus-visible:border-[var(--kd-accent)]"
        />
      </div>

      <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {visibleItems.length === 0 && (
          <p className="py-8 text-center text-xs text-[var(--kd-muted)]">No items match.</p>
        )}
        {visibleItems.map((item) => (
          <div
            key={item.code}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--kd-border)] bg-[var(--kd-surface-raised)] px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--kd-text)]">{item.name}</p>
              <p className="truncate text-[11px] text-[var(--kd-muted)]">
                #{item.code} &middot; {item.category} &middot; ₹{getEffectivePrice(item)}
                {item.discountPercent > 0 && ` (${item.discountPercent}% off)`}
                {item.isSpecial && " · ★ Special"}
              </p>
            </div>
            <AvailabilityToggle
              available={item.available}
              pending={togglingCode === item.code}
              onToggle={(next) => onToggleAvailability(item.code, next)}
            />
          </div>
        ))}
      </div>

      {canOpenFullMenu ? (
        <Link
          href="/owner/menu"
          className="group mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--kd-border)] py-2.5 text-sm font-medium text-[var(--kd-text)] transition-colors hover:border-[var(--kd-accent)] hover:text-[var(--kd-accent)]"
        >
          View Full Menu
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <p className="mt-3 text-center text-[11px] text-[var(--kd-muted)]">
          Full menu management is in the Owner Portal.
        </p>
      )}
    </div>
  );
}
