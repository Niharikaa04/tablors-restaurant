"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Submit button for server-action forms. While the action is in flight it is
 * disabled and shows a loading label, so a second click cannot start a second
 * request. This is only the UX half: payments are also protected server-side
 * (row lock, idempotency key, unique transaction reference).
 */
export function SubmitOnceButton({
  children,
  pendingLabel = "Processing…",
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
