"use client";

import { useMemo, useState } from "react";
import type { MenuItem } from "@/server/modules/demo-store/store";
import { CategoryTabs } from "./category-tabs";
import { MenuItemCard } from "./menu-item-card";

const ALL_CATEGORY = "All";
const SPECIAL_TAB = "Today's Special";

export function CustomerMenuView({ items }: { items: MenuItem[] }) {
  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.category)));
    const hasSpecials = items.some((item) => item.isSpecial && item.available);
    return [ALL_CATEGORY, ...(hasSpecials ? [SPECIAL_TAB] : []), ...unique];
  }, [items]);

  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);

  const visibleItems = useMemo(() => {
    if (activeCategory === ALL_CATEGORY) return items;
    if (activeCategory === SPECIAL_TAB) return items.filter((item) => item.isSpecial && item.available);
    return items.filter((item) => item.category === activeCategory);
  }, [items, activeCategory]);

  return (
    <div>
      <CategoryTabs
        categories={categories}
        active={activeCategory}
        onSelect={setActiveCategory}
      />

      {visibleItems.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--tablor-text-muted)]">
          No items in this category.
        </p>
      ) : (
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <MenuItemCard key={item.code} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
