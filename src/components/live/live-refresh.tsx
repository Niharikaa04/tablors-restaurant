"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

type LiveRefreshProps = {
  intervalMs?: number;
};

/**
 * Near-real-time updates for the in-memory V1 store: re-runs the server
 * component every few seconds via refresh() (no full page reload).
 * Pauses while the tab is hidden, refreshes immediately on return, and
 * never runs more than one interval at a time.
 */
export function LiveRefresh({ intervalMs = 5000 }: LiveRefreshProps) {
  const router = useRouter();
  // Skip a tick while the previous refresh is still running; otherwise slow
  // database responses pile up and starve real navigation clicks.
  const [isPending, startTransition] = useTransition();
  const busy = useRef(false);
  useEffect(() => {
    if (!isPending) busy.current = false;
  }, [isPending]);

  useEffect(() => {
    const refresh = () => {
      if (busy.current) return;
      busy.current = true;
      startTransition(() => router.refresh());
    };
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => refresh(), intervalMs);
      }
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, [router, intervalMs]);

  return null;
}