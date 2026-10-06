import { Star } from "lucide-react";
import { requirePermission } from "@/server/modules/auth/session";
import { getFeedbackInsights } from "@/server/modules/feedback/insights";

const fmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const card = "rounded-xl border border-zinc-800 bg-zinc-950 p-5";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= Math.round(n) ? "fill-[#d7fe3b] text-[#d7fe3b]" : "text-zinc-700"}`} />
      ))}
    </span>
  );
}

export default async function FeedbackPage() {
  await requirePermission("feedback");
  const d = getFeedbackInsights();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Customer Feedback</h1>
        <p className="mt-1 text-sm text-zinc-400">{d.total} review{d.total === 1 ? "" : "s"} from paid orders.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="text-xs text-zinc-500">Average rating</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{d.total ? d.averageRating.toFixed(1) : "—"}<span className="text-sm text-zinc-500"> / 5</span></p>
          {d.total > 0 && <div className="mt-1"><Stars n={d.averageRating} /></div>}
        </div>
        <div className={card}>
          <p className="text-xs text-zinc-500">Complaints (any rating ≤ 2★)</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-50">{d.complaints.length}</p>
        </div>
        <div className={`${card} sm:col-span-2`}>
          <p className="text-xs text-zinc-500">Most common problem</p>
          <p className="mt-2 text-lg font-semibold text-zinc-50">
            {d.mostCommonProblem ? `${d.mostCommonProblem.name} (${d.mostCommonProblem.count} low rating${d.mostCommonProblem.count === 1 ? "" : "s"})` : "No problems reported"}
          </p>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-sm font-semibold text-zinc-100">By category</h2>
        <div className="mt-3 space-y-3">
          {d.categories.map((c) => (
            <div key={c.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-zinc-300">{c.name}</span>
              <span className="flex items-center gap-3">
                <Stars n={c.average} />
                <span className="w-8 text-right text-zinc-100">{d.total ? c.average.toFixed(1) : "—"}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        <h2 className="px-4 pt-4 text-sm font-semibold text-zinc-100">Recent feedback</h2>
        <div className="divide-y divide-zinc-900">
          {d.recent.length === 0 && <p className="px-4 py-10 text-center text-sm text-zinc-500">No feedback yet.</p>}
          {d.recent.map((f) => (
            <div key={f.id} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                <span>Table {f.tableId} · {fmt.format(new Date(f.submittedAt))}</span>
                <span className="flex gap-3">
                  <span>Food <Stars n={f.foodRating} /></span>
                  <span>Service <Stars n={f.serviceRating} /></span>
                  <span>Ordering <Stars n={f.orderingRating} /></span>
                </span>
              </div>
              {f.comment && <p className="text-zinc-200">{f.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
