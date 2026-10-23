"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { sendMemberMessageAction, type MessageState } from "./message-actions";

export type MemberRow = {
  id: string;
  /** Already masked on the server, e.g. 98******10. Full numbers never reach the browser. */
  maskedPhone: string;
  balance: number;
  status: string;
};

const MAX = 100; // keep in step with MAX_RECIPIENTS_PER_SEND on the server
const LIMIT = 300;
const idle: MessageState = { status: "idle" };

const TEMPLATES = [
  { label: "Offer", text: "Thank you for visiting! Show this message on your next visit and enjoy a special offer." },
  { label: "Discount", text: "Enjoy 10% off your next bill. Valid this week only. See you soon!" },
];

/**
 * Members table with privacy-masked numbers. Click a number (or its box) to
 * select that member, or use "Select all". Messages go only to the selected
 * members, so the owner can start with one or two and widen slowly instead of
 * spending the sending limit on everyone.
 */
export function MemberMessenger({ members }: { members: MemberRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [state, formAction, pending] = useActionState(sendMemberMessageAction, idle);

  const selectable = members.filter((m) => m.status === "active");
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(m.id));
  const tooMany = selected.size > MAX;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="w-8 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all members"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? new Set() : new Set(selectable.map((m) => m.id)))
                  }
                  className="h-4 w-4 accent-[#d7fe3b]"
                />
              </th>
              <th>Mobile</th>
              <th>Points</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const on = selected.has(m.id);
              const blocked = m.status !== "active";
              return (
                <tr key={m.id} className={`border-t border-zinc-800 text-zinc-200 ${on ? "bg-[#d7fe3b]/5" : ""}`}>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`Select member ${m.maskedPhone}`}
                      checked={on}
                      disabled={blocked}
                      onChange={() => toggle(m.id)}
                      className="h-4 w-4 accent-[#d7fe3b] disabled:opacity-30"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => toggle(m.id)}
                      title={blocked ? "Blocked members can't be messaged" : "Click to select"}
                      className="font-mono tracking-wider hover:text-[#d7fe3b] disabled:cursor-not-allowed disabled:text-zinc-500"
                    >
                      {m.maskedPhone}
                    </button>
                  </td>
                  <td>{m.balance}</td>
                  <td>{m.status}</td>
                  <td className="text-right">
                    <Link className="underline" href={`/owner/loyalty?customer=${m.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={formAction} className="mt-5 space-y-3 rounded-lg border border-zinc-800 p-4">
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="memberId" value={id} />
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white">Send an offer or discount message</p>
          <p className="text-xs text-zinc-400">
            {selected.size === 0
              ? "Select members above (one, a few, or all)."
              : `${selected.size} selected`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setMessage(t.text)}
              className="h-8 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Use {t.label} template
            </button>
          ))}
        </div>

        <textarea
          name="message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, LIMIT))}
          rows={3}
          placeholder="Type your offer or discount message…"
          className="w-full rounded-lg border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-[#d7fe3b]"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-zinc-500">
            {message.length}/{LIMIT} · up to {MAX} members per send
          </span>
          <button
            type="submit"
            disabled={pending || selected.size === 0 || tooMany || message.trim().length < 5}
            className="h-10 rounded-lg bg-[#d7fe3b] px-5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Sending…" : `Send to ${selected.size || "selected"}`}
          </button>
        </div>
        {tooMany && (
          <p className="text-xs text-red-300">Select {MAX} members or fewer for one send.</p>
        )}
        {state.status !== "idle" && (
          <p
            role="status"
            className={`text-sm ${state.status === "ok" ? "text-[#d7fe3b]" : "text-red-300"}`}
          >
            {state.text}
          </p>
        )}
      </form>
    </div>
  );
}
