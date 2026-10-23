"use client";

export default function ReportsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert">
      <h1 className="text-2xl text-[var(--color-text-primary)]">Reports</h1>
      <p className="mt-6 text-sm text-[var(--color-text-muted)]">
        Something went wrong while building the report.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        Try again
      </button>
    </div>
  );
}