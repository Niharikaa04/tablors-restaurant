"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useNotifications } from "@/components/notifications/useNotifications";

type Item = ReturnType<typeof useNotifications>["items"][number];

/** Where a click on each notification type should take the owner. */
const HREF: Record<string, string> = {
  ORDER_NEW: "/owner/orders",
  PAYMENT_RECEIVED: "/owner/billing",
  ITEM_UNAVAILABLE: "/owner/menu",
  TABLE_RESERVED: "/owner/reservations",
  ORDER_CANCELLED: "/owner/orders",
  DEVICE_OFFLINE: "/owner/devices",
  DEVICE_LOW_BATTERY: "/owner/devices",
  KITCHEN_ORDER_DELAYED: "/owner/orders",
  OFFER_CREATED: "/owner/offers",
  LOYALTY_POINTS_EARNED: "/owner/loyalty",
};

function ago(d: string | number | Date): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/**
 * Bell for the Overview header. Reads the SAME list as the Notifications page (useNotifications),
 * so the badge, the dropdown and the page can never disagree.
 */
export function NotificationBell() {
  const { items, unread: unreadCount, setStatus, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  // "View all" expands the list inside this panel (no separate page).
  const [expanded, setExpanded] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // setStatus throws when the server rejects the update; never let that crash the dashboard.
  const markRead = async (id: string) => { try { await setStatus(id, "read"); } catch { /* keeps showing unread; owner can retry */ } };
  const unread = items.filter((n: Item) => n.status === "unread");
  const sorted = [...items].sort(
    (a: Item, b: Item) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latest = expanded ? sorted : sorted.slice(0, 6);
  const allSelected = sorted.length > 0 && sorted.every((n) => selected.has(n.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteOne = async (id: string) => {
    try { await remove(id); } catch { /* stays in the list; owner can retry */ }
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const deleteSelected = async () => {
    setBusy(true);
    for (const id of [...selected]) await deleteOne(id);
    setBusy(false);
    setSelected(new Set());
    setSelecting(false);
  };

  const closeSelecting = () => { setSelecting(false); setSelected(new Set()); };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setExpanded(false); closeSelecting(); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setExpanded(false); closeSelecting(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[#23251F] bg-[#15170F] text-[#F2F3EC] transition-colors hover:border-[#D7FE3B]/50"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E27468] px-1 text-[11px] font-bold leading-none text-black">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div role="dialog" aria-label="Notifications" className={`absolute right-0 z-50 mt-2 rounded-xl border border-[#23251F] bg-[#15170F] text-[#F2F3EC] shadow-2xl ${expanded ? "w-[28rem]" : "w-[22rem]"} max-w-[calc(100vw-2rem)]`}>
          <div className="flex items-center justify-between gap-2 border-b border-[#23251F] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-3">
              {unread.length > 0 && !selecting ? (
                <button type="button" onClick={async () => { for (const n of unread) await markRead(n.id); }} className="text-xs text-[#D7FE3B] hover:underline">
                  Mark all read
                </button>
              ) : null}
              {sorted.length > 0 ? (
                <button type="button" onClick={() => (selecting ? closeSelecting() : setSelecting(true))} className="text-xs text-[#D7FE3B] hover:underline">
                  {selecting ? "Cancel" : "Select"}
                </button>
              ) : null}
            </div>
          </div>

          {selecting ? (
            <div className="flex items-center justify-between gap-2 border-b border-[#23251F] bg-[#1c1f14] px-4 py-2 text-xs">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(sorted.map((n) => n.id)))}
                  className="h-4 w-4 accent-[#D7FE3B]"
                />
                Select all ({sorted.length})
              </label>
              <button
                type="button"
                disabled={selected.size === 0 || busy}
                onClick={() => void deleteSelected()}
                className="flex items-center gap-1.5 rounded-md bg-[#E27468] px-2.5 py-1 font-semibold text-black disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {busy ? "Deleting…" : `Delete${selected.size ? ` (${selected.size})` : ""}`}
              </button>
            </div>
          ) : null}

          <ul className={`overflow-y-auto ${expanded ? "max-h-[28rem]" : "max-h-96"}`}>
            {latest.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#9DA194]">No notifications yet.</li>
            ) : (
              latest.map((n: Item) => (
                <li key={n.id} className="flex items-stretch border-b border-[#23251F] last:border-0">
                  {selecting ? (
                    <label className="flex cursor-pointer items-center pl-4">
                      <input
                        type="checkbox"
                        checked={selected.has(n.id)}
                        onChange={() => toggle(n.id)}
                        aria-label={`Select ${n.title}`}
                        className="h-4 w-4 accent-[#D7FE3B]"
                      />
                    </label>
                  ) : null}
                  <Link
                    href={HREF[String(n.type).toUpperCase()] ?? "/owner"}
                    onClick={(e) => {
                      if (selecting) { e.preventDefault(); toggle(n.id); return; }
                      setOpen(false);
                      setExpanded(false);
                      if (n.status === "unread") void markRead(n.id);
                    }}
                    className={`block min-w-0 flex-1 px-4 py-3 transition-colors hover:bg-[#1c1f14] ${n.status === "unread" ? "" : "opacity-60"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                        {n.status === "unread" ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#D7FE3B]" aria-label="unread" /> : null}
                        {n.title}
                        {n.priority === "high" || n.priority === "critical" ? <span className="text-xs text-[#E27468]">{n.priority}</span> : null}
                      </span>
                      <span className="shrink-0 text-[11px] text-[#9DA194]">{ago(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-[#9DA194]">{n.message}</span>
                  </Link>
                  {!selecting ? (
                    <button
                      type="button"
                      onClick={() => void deleteOne(n.id)}
                      aria-label={`Delete notification: ${n.title}`}
                      title="Delete"
                      className="flex w-10 shrink-0 items-center justify-center text-[#9DA194] transition-colors hover:bg-[#E27468]/10 hover:text-[#E27468]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>

          {sorted.length > 6 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="block w-full border-t border-[#23251F] px-4 py-3 text-center text-sm text-[#D7FE3B] hover:bg-[#1c1f14]"
            >
              {expanded ? "Show less" : `View all notifications (${sorted.length})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}