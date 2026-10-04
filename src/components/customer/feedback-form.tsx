"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StarRating } from "./star-rating";
import { submitCustomerFeedback } from "@/server/modules/feedback/actions";

export function FeedbackForm({
  orderId,
  tableId,
}: {
  orderId: string;
  tableId: string;
}) {
  const router = useRouter();
  const [foodRating, setFoodRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [orderingRating, setOrderingRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allRated = foodRating > 0 && serviceRating > 0 && orderingRating > 0;

  async function handleSubmit() {
    if (!allRated) {
      setErrorMsg("Please rate all three categories before submitting.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const result = await submitCustomerFeedback({
      orderId,
      tableId,
      foodRating,
      serviceRating,
      orderingRating,
      comment,
    });

    setSubmitting(false);

    if (result.ok) {
      // Re-runs the server page with the same ?order= param; it will
      // now find the feedback record and render the thank-you state.
      router.refresh();
    } else {
      setErrorMsg(result.error);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] p-5">
      <h2 className="text-lg font-semibold text-[var(--tablor-text-primary)]">
        How was your experience?
      </h2>

      <div className="mt-5 space-y-5">
        <StarRating label="Food Quality" value={foodRating} onChange={setFoodRating} />
        <StarRating label="Service" value={serviceRating} onChange={setServiceRating} />
        <StarRating
          label="Ordering Experience"
          value={orderingRating}
          onChange={setOrderingRating}
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor="feedback-comment"
          className="text-sm font-medium text-[var(--tablor-text-primary)]"
        >
          Additional feedback (optional)
        </label>
        <textarea
          id="feedback-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Tell us more..."
          className="mt-2 w-full rounded-xl border border-[var(--tablor-border)] bg-[var(--tablor-icon-surface)] px-3 py-2 text-sm text-[var(--tablor-text-primary)] outline-none focus-visible:border-[var(--tablor-accent)]"
        />
      </div>

      {errorMsg && (
        <p className="mt-3 text-sm font-medium text-[var(--tablor-error)]">{errorMsg}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-5 w-full rounded-full bg-[var(--tablor-accent)] py-3 text-sm font-semibold text-[#0d0e0b] transition-opacity active:scale-[0.98] disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit Feedback"}
      </button>
    </div>
  );
}