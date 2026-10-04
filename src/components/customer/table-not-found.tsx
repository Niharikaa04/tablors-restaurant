/**
 * Shown when a /customer/menu/[tableId] link doesn't match a real table.
 *
 * Deliberately not Next's default not-found page: this stays inside the
 * tablor-customer chrome and speaks in the interface's voice (what
 * happened, what to do), per the brand's error-copy convention.
 */
export function TableNotFound({ tableId }: { tableId: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] px-6 py-12 text-center">
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--tablor-error)]/40 text-2xl text-[var(--tablor-error)]"
      >
        !
      </span>
      <h1 className="mt-4 text-lg font-semibold text-[var(--tablor-text-primary)]">
        Table not found
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[var(--tablor-text-muted)]">
        &quot;{tableId}&quot; doesn&apos;t match a table at this restaurant.
        Check the code on your table or ask staff to help.
      </p>
    </div>
  );
}