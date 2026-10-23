"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
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
    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer === undefined) {
        timer = setInterval(() => refresh(), intervalMs);
      }
    };

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}