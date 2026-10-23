"use client";

import { useState, useTransition } from "react";
import { LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { closeTicketAction, createTicketAction, replyTicketAction, type SupportActionResult } from "./actions";

export interface TicketRow {
  id: string;
  type: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  deviceId: string | null;
  createdLabel: string;
  messages: { from: "restaurant" | "support"; text: string; atLabel: string }[];
}

const TYPES = [
  { value: "device_problem", label: "Device problem" },
  { value: "replacement", label: "Replacement request" },
  { value: "software_issue", label: "Software issue" },
  { value: "installation", label: "Installation request" },
  { value: "chat", label: "Chat / general support" },
];
const typeLabel = (v: string) => TYPES.find((t) => t.value === v)?.label ?? v;
const STATUS = {
  open: ["Open", "bg-[#d7fe3b]/10 text-[#d7fe3b]"],
  in_progress: ["In progress", "bg-amber-500/10 text-amber-300"],
  resolved: ["Resolved", "bg-zinc-800 text-zinc-400"],
} as const;

const input =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d7fe3b] focus:outline-none";

export function SupportManager({
  tickets,
  deviceOptions,
}: {
  tickets: TicketRow[];
  deviceOptions: { id: string; label: string }[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ type: "device_problem", subject: "", description: "", deviceId: "" });
  const [reply, setReply] = useState("");

  function run(fn: () => Promise<SupportActionResult>, onOk?: () => void) {
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setNotice(r.error);
      else onOk?.();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Support</h1>
          <p className="mt-1 text-sm text-zinc-400">Raise a ticket for devices, software or installation.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#d7fe3b] px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Raise support ticket
        </button>
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {notice}
        </p>
      )}

      {showForm && (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">
              Issue type
              <select className={`${input} mt-1`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-400">
              Device (optional)
              <select className={`${input} mt-1`} value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
                <option value="">Not device specific</option>
                {deviceOptions.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
          </div>
          <input className={input} placeholder="Subject" maxLength={120} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className={input} rows={4} placeholder="Describe the problem" maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => createTicketAction({ ...form, deviceId: form.deviceId || null }),
                  () => {
                    setForm({ type: "device_problem", subject: "", description: "", deviceId: "" });
                    setShowForm(false);
                  }
                )
              }
              className="rounded-lg bg-[#d7fe3b] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              Submit ticket
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-900 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
        {tickets.length === 0 && (
          <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-500">
            <LifeBuoy className="h-4 w-4" /> No tickets yet.
          </p>
        )}
        {tickets.map((t) => {
          const [label, cls] = STATUS[t.status];
          const open = openId === t.id;
          return (
            <div key={t.id} className="p-4">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpenId(open ? null : t.id)}>
                <div>
                  <p className="text-sm font-medium text-zinc-100">
                    {t.id} · {t.subject}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {typeLabel(t.type)} · {t.createdLabel}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>
              </button>

              {open && (
                <div className="mt-4 space-y-3">
                  {t.messages.map((m, i) => (
                    <div key={i} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.from === "restaurant" ? "bg-zinc-900 text-zinc-200" : "ml-auto bg-[#d7fe3b]/10 text-[#d7fe3b]"}`}>
                      <p>{m.text}</p>
                      <p className="mt-1 text-[10px] opacity-60">{m.from === "restaurant" ? "You" : "Tablor support"} · {m.atLabel}</p>
                    </div>
                  ))}
                  {t.status !== "resolved" && (
                    <div className="flex flex-wrap gap-2">
                      <input className={`${input} flex-1`} placeholder="Write a message…" value={reply} onChange={(e) => setReply(e.target.value)} />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => replyTicketAction(t.id, reply), () => setReply(""))}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:text-[#d7fe3b] disabled:opacity-50"
                      >
                        <MessageSquare className="h-4 w-4" /> Send
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => closeTicketAction(t.id))} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900">
                        Mark resolved
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
