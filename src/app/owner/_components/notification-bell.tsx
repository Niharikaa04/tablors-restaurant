"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BatteryLow, Bell, Ban, CalendarCheck, Clock, IndianRupee, ShoppingBag, UtensilsCrossed, WifiOff, type LucideIcon } from "lucide-react";

interface Item { id: string; type: string; title: string; message: string; at: string; severity: "info" | "warning" | "critical"; href: string; read: boolean }

const COLOR: Record<Item["severity"], string> = { info: "text-zinc-400", warning: "text-amber-400", critical: "text-red-400" };
const ICON: Record<string, LucideIcon> = {
  order_new: ShoppingBag, payment_received: IndianRupee, item_unavailable: UtensilsCrossed, table_reserved: CalendarCheck,
  order_cancelled: Ban, device_offline: WifiOff, device_low_battery: BatteryLow, kitchen_order_delayed: Clock,
};
const POLL_MS = 30_000;

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Bell for the owner dashboard header: unread badge, latest alerts in a dropdown, one click to open or clear them. */
export function NotificationBell({ allHref = "/owner/notifications" }: { allHref?: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [failed, setFailed] = useState(false);
  const [connected, setConnected] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/owner/notifications", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { connected: boolean; unread: number; items: Item[] };
      setConnected(d.connected); setUnread(d.unread); setItems(d.items); setFailed(false);
    } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  // Refresh immediately when the server pushes a new notification (existing SSE stream).
  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.onmessage = () => { void load(); };
    return () => es.close();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function mark(body: { ids: string[] } | { all: true }) {
    try { await fetch("/api/owner/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); } finally { void load(); }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white">{unread > 9 ? "9+" : unread}</span> : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-3">
            <p className="text-sm font-semibold text-zinc-100">Notifications</p>
            {unread > 0 ? <button type="button" onClick={() => void mark({ all: true })} className="text-xs text-[var(--radium-green)] hover:underline">Mark all read</button> : null}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {failed ? <li className="px-4 py-6 text-center text-sm text-zinc-400">Couldn’t load notifications. <button type="button" onClick={() => void load()} className="text-[var(--radium-green)] underline">Retry</button></li>
              : !connected ? <li className="px-4 py-6 text-center text-sm text-amber-400">Notification source isn’t connected yet.</li>
              : items.length === 0 ? <li className="px-4 py-8 text-center text-sm text-zinc-400">You’re all caught up.</li>
              : items.map((n) => (
                <li key={n.id} className="border-b border-zinc-900 last:border-0">
                  <Link href={n.href} onClick={() => { setOpen(false); if (!n.read) void mark({ ids: [n.id] }); }} className={`flex gap-3 px-4 py-3 transition-colors hover:bg-zinc-900 ${n.read ? "opacity-60" : ""}`}>
                    {(() => { const Icon = ICON[n.type] ?? Bell; return <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLOR[n.severity]}`} aria-hidden />; })()}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><span className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-100">{n.title}{!n.read ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--radium-green)]" aria-label="unread" /> : null}</span><span className="shrink-0 text-[11px] text-zinc-500">{ago(n.at)}</span></span>
                      <span className="block text-xs text-zinc-400">{n.message}</span>
                    </span>
                  </Link>
                </li>))}
          </ul>
          <Link href={allHref} onClick={() => setOpen(false)} className="block border-t border-zinc-900 px-4 py-3 text-center text-sm text-[var(--radium-green)] hover:bg-zinc-900">View all notifications</Link>
        </div>
      ) : null}
    </div>
  );
}