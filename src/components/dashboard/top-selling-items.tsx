import Link from "next/link";
import { getTopSellingItems } from "@/server/modules/demo-store/store";
import { SectionHeader } from "./section-header";

export function TopSellingItems() {
  const items = getTopSellingItems(5);
  const max = Math.max(1, ...items.map((i) => i.qtySold));

  return (
    <div className="rounded-xl border border-[var(--ov-border)] bg-[var(--ov-surface)] p-5">
      <SectionHeader title="Top Selling Items" subtitle="By quantity, today" href="/owner/reports" hrefLabel="Reports" />

      <div className="mt-4 space-y-3.5">
        {items.length === 0 && <p className="text-sm text-[var(--ov-muted)]">No items ordered yet today.</p>}

        {items.map((item, index) => (
          <Link
            key={item.code}
            href={`/owner/menu#${item.code}`}
            className="block rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-[var(--ov-icon-surface)]"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate text-[var(--ov-text)]">
                <span className="tabular-nums text-xs text-[var(--ov-muted)]">{index + 1}</span>
                <span className="truncate">{item.name}</span>
              </span>
              <span className="shrink-0 text-xs text-[var(--ov-text-secondary)]">
                {item.qtySold} sold · ₹{item.revenueRupees}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--ov-border)]">
              <div
                className="h-full rounded-full bg-[var(--ov-accent)]"
                style={{ width: `${(item.qtySold / max) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
