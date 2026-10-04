"use client";

export function CategoryTabs({
  categories,
  active,
  onSelect,
}: {
  categories: string[];
  active: string;
  onSelect: (category: string) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Menu categories"
      className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1"
    >
      {categories.map((category) => {
        const isActive = category === active;
        return (
          <button
            key={category}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(category)}
            className={`min-h-11 shrink-0 rounded-full border px-5 py-2.5 text-sm font-medium transition-colors active:scale-[0.97] ${
              isActive
                ? "border-[var(--tablor-accent)] bg-[var(--tablor-accent)] text-[#0d0e0b] shadow-[0_0_0_1px_var(--tablor-accent)]"
                : "border-[var(--tablor-border)] bg-[var(--tablor-icon-surface)] text-[var(--tablor-text-secondary)] active:border-[var(--tablor-accent)]/60"
            }`}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}