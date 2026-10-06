import { FeedbackForm } from "./feedback-form";

/**
 * Full takeover view shown once THIS specific order (identified by its
 * real orderId, not the table) has a paid bill. Replaces the entire
 * ordering session — menu and cart are not shown alongside this.
 */
export function OrderCompletedPanel({
  orderId,
  tableId,
  feedbackSubmitted,
}: {
  orderId: string;
  tableId: string;
  feedbackSubmitted: boolean;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-[var(--tablor-accent)] bg-[var(--tablor-card)] px-6 py-8 text-center shadow-[0_0_0_1px_var(--tablor-accent)]">
        <p className="text-xl font-semibold text-[var(--tablor-accent)]">
          Payment Successful
        </p>
        <p className="mt-1 text-sm text-[var(--tablor-text-secondary)]">
          Order #{orderId} &middot; Completed
        </p>
        <p className="mt-4 text-sm text-[var(--tablor-text-primary)]">
          Thank you for dining with us.
        </p>
      </div>

      <div className="mt-6">
        {feedbackSubmitted ? (
          <div className="rounded-2xl border border-[var(--tablor-border)] bg-[var(--tablor-card)] px-5 py-6 text-center">
            <p className="text-base font-medium text-[var(--tablor-accent)]">
              Thank you for your feedback!
            </p>
            <p className="mt-1 text-sm text-[var(--tablor-text-secondary)]">
              Your feedback has been submitted successfully.
            </p>
          </div>
        ) : (
          <FeedbackForm orderId={orderId} tableId={tableId} />
        )}
      </div>
    </div>
  );
}