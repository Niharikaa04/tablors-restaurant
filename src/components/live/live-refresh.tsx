"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type LiveRefreshProps = {
  intervalMs?: number;
};

/**
 * Near-real-time updates for the in-memory V1 store: re-runs the server
 * component every few seconds via router.refresh() (no full page reload).
 * Pauses while the tab is hidden, refreshes immediately on return, and
 * never runs more than one interval at a time.
 */
export function LiveRefresh({ intervalMs = 5000 }: LiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => router.refresh(), intervalMs);
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
        router.refresh();
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