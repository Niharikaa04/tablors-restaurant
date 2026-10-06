"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarX, CheckCircle2, LogIn, Plus, Users } from "lucide-react";
import {
  cancelReservationAction,
  checkInReservationAction,
  markTableAction,
  reserveAction,
  type ReservationActionResult,
} from "./actions";

export interface ReservationRow {
  id: string;
  timeLabel: string;
  tableLabel: string;
  guestName: string;
  phone: string;
  partySize: number;
  status: "booked" | "checked_in" | "cancelled";
  tableStatus: "available" | "occupied" | "reserved" | null;
  tableBusy: boolean;
}

export interface TableOption {
  id: string;
  label: string;
}

type DialogState = { mode: "reserve" } | { mode: "cancel"; row: ReservationRow };

const RESERVATION_LABEL: Record<ReservationRow["status"], string> = {
  booked: "Booked",
  checked_in: "Checked in",
  cancelled: "Cancelled",
};
const TABLE_LABEL = { available: "Available", occupied: "Occupied", reserved: "Reserved" } as const;

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d7fe3b] focus:outline-none";
const rowButton =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-[#d7fe3b] disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50";

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function ReservationsManager({
  rows,
  tableOptions,
  dateLabel,
}: {
  rows: ReservationRow[];
  tableOptions: TableOption[];
  dateLabel: string;
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ReservationActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setNotice(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Reservations</h1>
          <p className="mt-1 text-sm text-zinc-400">Today&apos;s reservations · {dateLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setDialog({ mode: "reserve" });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#d7fe3b] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Reserve
        </button>
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time — Table</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Reservation</th>
              <th className="px-4 py-3 font-medium">Table status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No reservations for today.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const active = r.status !== "cancelled";
              return (
                <tr key={r.id} className={r.status === "cancelled" ? "opacity-60" : undefined}>
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    {r.timeLabel} — {r.tableLabel}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-zinc-100">{r.guestName}</p>
                    <p className="text-xs text-zinc-500">{r.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{r.partySize}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "booked"
                          ? "bg-[#d7fe3b]/10 text-[#d7fe3b]"
                          : r.status === "checked_in"
                            ? "bg-zinc-100/10 text-zinc-100"
                            : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {RESERVATION_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.tableStatus ? (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.tableStatus === "occupied"
                            ? "bg-amber-400/10 text-amber-300"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {TABLE_LABEL[r.tableStatus]}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {active ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {r.status === "booked" && (
                          <>
                            <button
                              type="button"
                              className={rowButton}
                              disabled={pending}
                              onClick={() => run(() => checkInReservationAction(r.id))}
                            >
                              <LogIn className="h-3.5 w-3.5" /> Check-in
                            </button>
                            <button
                              type="button"
                              className={dangerButton}
                              disabled={pending}
                              onClick={() => {
                                setNotice(null);
                                setDialog({ mode: "cancel", row: r });
                              }}
                            >
                              <CalendarX className="h-3.5 w-3.5" /> Cancel reservation
                            </button>
                          </>
                        )}
                        {r.tableStatus !== "occupied" && (
                          <button
                            type="button"
                            className={rowButton}
                            disabled={pending}
                            onClick={() => run(() => markTableAction(r.id, "occupied"))}
                          >
                            <Users className="h-3.5 w-3.5" /> Mark table occupied
                          </button>
                        )}
                        {r.tableStatus !== "available" && (
                          <button
                            type="button"
                            className={rowButton}
                            disabled={pending || r.tableBusy}
                            title={r.tableBusy ? "This table has an active order" : undefined}
                            onClick={() => run(() => markTableAction(r.id, "available"))}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark table available
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog?.mode === "reserve" && (
        <ReserveDialog tableOptions={tableOptions} onClose={() => setDialog(null)} />
      )}
      {dialog?.mode === "cancel" && (
        <CancelDialog key={dialog.row.id} row={dialog.row} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function ReserveDialog({
  tableOptions,
  onClose,
}: {
  tableOptions: TableOption[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscape(onClose);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      tableId: String(fd.get("tableId") ?? ""),
      guestName: String(fd.get("guestName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      partySize: String(fd.get("partySize") ?? ""),
      time: String(fd.get("time") ?? ""),
    };
    startTransition(async () => {
      const res = await reserveAction(payload);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-dialog-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6"
      >
        <h2 id="reserve-dialog-title" className="text-lg font-semibold text-zinc-50">
          Reserve a table
        </h2>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Table</span>
          <select name="tableId" required defaultValue={tableOptions[0]?.id} className={inputClass}>
            {tableOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Guest name</span>
          <input name="guestName" required minLength={2} maxLength={80} className={inputClass} placeholder="Full name" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Phone</span>
          <input name="phone" required maxLength={24} className={inputClass} placeholder="+91 98765 43210" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Party size</span>
            <input name="partySize" type="number" required min={1} max={50} defaultValue={2} className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Time (today)</span>
            <input name="time" type="time" required className={inputClass} />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={pending || tableOptions.length === 0}
            className="rounded-lg bg-[#d7fe3b] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Reserve"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CancelDialog({ row, onClose }: { row: ReservationRow; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscape(onClose);

  function confirmCancel() {
    startTransition(async () => {
      const res = await cancelReservationAction(row.id);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      aria-describedby="cancel-dialog-desc"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 id="cancel-dialog-title" className="text-lg font-semibold text-zinc-50">
          Cancel reservation?
        </h2>
        <p id="cancel-dialog-desc" className="text-sm text-zinc-400">
          <span className="text-zinc-100">{row.guestName}</span>&apos;s reservation at {row.timeLabel} for{" "}
          {row.tableLabel} will be cancelled. This cannot be undone.
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Keep reservation
          </button>
          <button
            type="button"
            onClick={confirmCancel}
            disabled={pending}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {pending ? "Cancelling..." : "Cancel reservation"}
          </button>
        </div>
      </div>
    </div>
  );
}