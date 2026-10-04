// src/app/owner/notifications/page.tsx
"use client";
import { useState } from "react";
import { useNotifications } from "@/components/notifications/useNotifications";

const FILTERS = ["ALL", "ORDER_NEW", "PAYMENT_RECEIVED", "ITEM_UNAVAILABLE", "TABLE_RESERVED",
  "ORDER_CANCELLED", "DEVICE_OFFLINE", "DEVICE_LOW_BATTERY", "KITCHEN_ORDER_DELAYED"];

export default function NotificationsPage() {
  const { items, setStatus } = useNotifications();
  const [filter, setFilter] = useState("ALL");
  const shown = items.filter(n => filter === "ALL" || n.type === filter);

  return (
    <main className="p-8 text-[#F2F3EC]">
      <h1 className="text-3xl font-semibold">Notifications</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-[#D7FE3B] text-[#D7FE3B]" : "border-[#23251F] text-[#9DA194]"}`}>
            {f === "ALL" ? "All" : f.replaceAll("_", " ").toLowerCase()}
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {shown.length === 0 && <li className="text-[#9DA194]">No notifications yet.</li>}
        {shown.map(n => (
          <li key={n.id} className={`flex items-center justify-between rounded-xl border bg-[#15170F] p-4
            ${n.status === "unread" ? "border-[#D7FE3B]/40" : "border-[#23251F]"}`}>
            <div>
              <p className="font-medium">{n.title}
                {n.priority === "high" || n.priority === "critical"
                  ? <span className="ml-2 text-xs text-[#E27468]">{n.priority}</span> : null}
              </p>
              <p className="text-sm text-[#9DA194]">{n.message}</p>
              <p className="mt-1 text-xs text-[#9DA194]">{new Date(n.createdAt).toLocaleString()} · {n.status}</p>
            </div>
            <div className="flex gap-2">
              {n.status === "unread" && <button onClick={() => setStatus(n.id, "read")} className="text-sm text-[#D7FE3B]">Mark read</button>}
              {n.status !== "acknowledged" && n.status !== "resolved" &&
                <button onClick={() => setStatus(n.id, "acknowledged")} className="text-sm text-[#D7FE3B]">Acknowledge</button>}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}