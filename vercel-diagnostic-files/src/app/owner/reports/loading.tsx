export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading reports">
      <div className="h-8 w-40 animate-pulse rounded bg-[var(--color-surface-1)]" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius-brand)] bg-[var(--color-surface-1)]" />
        ))}
      </div>
      <div className="mt-10 h-64 animate-pulse rounded-[var(--radius-brand)] bg-[var(--color-surface-1)]" />
    </div>
  );
}