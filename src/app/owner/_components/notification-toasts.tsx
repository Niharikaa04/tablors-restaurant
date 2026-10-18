"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

type Item = {
  id: string;
  title: string;
  message: string;
  href: string;
  read: boolean;
  severity: "info" | "warning" | "critical";
};

const POLL_MS = 5_000;
const SHOW_MS = 9_000;
const SEEN_KEY = "tablor:toasts-seen";

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200)));
  } catch {
    /* storage unavailable: popups may repeat after a reload, nothing else */
  }
}

/**
 * Popup alerts for the whole owner portal. Each notification id pops up once
 * per browser session (tracked in sessionStorage), so refreshes, page changes
 * and overlapping polls never repeat a popup. The first load only records what
 * already exists, so old unread items don't flood the screen.
 */
export function NotificationToasts() {
  const [toasts, setToasts] = useState<Item[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const inFlight = useRef(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((n) => n.id !== id));
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/owner/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch {
      /* the bell still shows it as unread */
    }
  }, []);

  const load = useCallback(async () => {
    if (inFlight.current) return; // never overlap requests
    inFlight.current = true;
    try {
      const res = await fetch("/api/owner/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: Item[] };
      const items = data.items ?? [];

      if (seen.current === null) {
        const known = loadSeen();
        // First ever load in this session: don't pop what is already there.
        if (known.size === 0) items.forEach((n) => known.add(n.id));
        seen.current = known;
        saveSeen(known);
        return;
      }

      const fresh = items.filter((n) => !n.read && !seen.current!.has(n.id));
      if (fresh.length === 0) return;
      fresh.forEach((n) => seen.current!.add(n.id));
      saveSeen(seen.current);

      setToasts((list) => [...fresh.reverse(), ...list].slice(0, 4));
      for (const n of fresh) {
        timers.current.set(n.id, setTimeout(() => dismiss(n.id), SHOW_MS));
      }
    } catch {
      /* try again on the next tick */
    } finally {
      inFlight.current = false;
    }
  }, [dismiss]);

  useEffect(() => {
    void load();
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    // The server pushes an event when a notification is created; poll right away.
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = () => void load();

    const pending = timers.current;
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      es.close();
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, [load]);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((n) => (
        <div
          key={n.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-zinc-950 p-3 shadow-2xl ${
            n.severity === "critical"
              ? "border-red-500/60"
              : n.severity === "warning"
                ? "border-amber-400/60"
                : "border-zinc-700"
          }`}
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-[var(--radium-green)]" aria-hidden />
          <Link
            href={n.href}
            onClick={() => {
              void markRead(n.id);
              dismiss(n.id);
            }}
            className="min-w-0 flex-1"
          >
            <span className="block truncate text-sm font-medium text-zinc-100">{n.title}</span>
            <span className="block text-xs text-zinc-400">{n.message}</span>
          </Link>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => dismiss(n.id)}
            className="rounded p-1 text-zinc-500 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
