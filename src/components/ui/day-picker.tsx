"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Date selector for record pages. Today is the default view and the calendar
 * reaches any earlier day. Future days are blocked.
 * The choice lives in ?date=YYYY-MM-DD, so it survives refreshes and can be
 * shared as a link.
 */
export function DayPicker({
  value,
  today,
}: {
  value: string;
  today: string;
  /** Kept optional so older call sites still compile; no longer shown. */
  yesterday?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(day: string) {
    const next = new URLSearchParams(params.toString());
    next.delete("notice");
    next.delete("bill");
    if (day === today) next.delete("date");
    else next.set("date", day);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm ${
      active
        ? "border-[var(--color-gold-500)] text-[var(--color-gold-500)]"
        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
    }`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" className={chip(value === today)} onClick={() => go(today)}>
        Today
      </button>

      <label className="ml-1 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <span>Pick a date</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={(e) => {
            if (e.target.value) go(e.target.value);
          }}
          className="rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-transparent px-3 py-1.5 text-sm text-[var(--color-text-primary)] [color-scheme:dark]"
        />
      </label>
    </div>
  );
}