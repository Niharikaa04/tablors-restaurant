/**
 * Shown instantly while an Owner page loads, so switching tabs responds
 * immediately instead of the screen freezing until the server finishes.
 */
export default function OwnerLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-zinc-900" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-900" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-zinc-900" />
    </div>
  );
}
