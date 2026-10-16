"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarOff, Lock, Pencil, Plus, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import { lockStaffPage } from "@/server/modules/auth/staff-pin-actions";
import {
  addLeaveAction,
  addStaffAction,
  cancelLeaveAction,
  changeStaffRoleAction,
  deleteStaffAction,
  editStaffAction,
  setStaffStatusAction,
  type StaffActionResult,
} from "./actions";

type Role = "owner" | "manager" | "cashier" | "kitchen" | "waiter";
type LeaveType = "casual" | "sick" | "unpaid";

export interface LeaveRow {
  id: string;
  type: LeaveType;
  fromLabel: string;
  toLabel: string;
  days: number;
  reason: string;
  when: "past" | "current" | "upcoming";
}

export interface StaffRow {
  id: string;
  name: string;
  contact: string;
  role: Role;
  status: "active" | "inactive";
  lastActiveLabel: string;
  joinedOn: string; // yyyy-mm-dd, "" when not set
  joinedLabel: string;
  onLeave: boolean;
  leaves: LeaveRow[];
  editable: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
  waiter: "Waiter",
};

const LEAVE_LABEL: Record<LeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  unpaid: "Unpaid",
};

type FormDialogState =
  | { mode: "add" }
  | { mode: "edit"; member: StaffRow }
  | { mode: "role"; member: StaffRow };

type DialogState =
  | FormDialogState
  | { mode: "delete"; member: StaffRow }
  | { mode: "leaves"; memberId: string };

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d7fe3b] focus:outline-none";
const rowButton =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-[#d7fe3b] disabled:opacity-50";
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
/** Date input that opens the calendar on click, with a light icon on dark. */
function DateField({
  name,
  value,
  onChange,
  defaultValue,
  required,
  min,
}: {
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  required?: boolean;
  min?: string;
}) {
  const controlled = value !== undefined;
  return (
    <input
      name={name}
      type="date"
      required={required}
      min={min}
      {...(controlled
        ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
        : { defaultValue })}
      onClick={(e) => {
        try {
          e.currentTarget.showPicker();
        } catch {
          // Older browsers: the native icon still works.
        }
      }}
      className={`${inputClass} cursor-pointer [color-scheme:dark]`}
    />
  );
}
export function StaffManager({
  members,
  assignableRoles,
}: {
  members: StaffRow[];
  assignableRoles: Role[];
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleStatus(member: StaffRow) {
    const next = member.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      const res = await setStaffStatusAction(member.id, next);
      setNotice(res.ok ? null : res.error);
    });
  }

  const leavesMember =
    dialog?.mode === "leaves" ? (members.find((m) => m.id === dialog.memberId) ?? null) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Staff Management</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage restaurant staff and their access.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={lockStaffPage}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2.5 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              <Lock className="h-4 w-4" />
              Lock
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setDialog({ mode: "add" });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#d7fe3b] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Staff
          </button>
        </div>
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email / Phone</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Active</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {members.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  No staff yet. Use Add Staff to create the first member.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className={m.status === "inactive" ? "opacity-60" : undefined}>
                <td className="px-4 py-3 font-medium text-zinc-100">{m.name}</td>
                <td className="px-4 py-3 text-zinc-400">{m.contact}</td>
                <td className="px-4 py-3 text-zinc-300">{ROLE_LABEL[m.role]}</td>
                <td className="px-4 py-3 text-zinc-400">{m.joinedLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        m.status === "active"
                          ? "bg-[#d7fe3b]/10 text-[#d7fe3b]"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {m.status === "active" ? "Active" : "Inactive"}
                    </span>
                    {m.onLeave && (
                      <span className="inline-flex rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                        On leave
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400">{m.lastActiveLabel}</td>
                <td className="px-4 py-3">
                  {m.editable ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className={rowButton}
                        disabled={pending}
                        onClick={() => {
                          setNotice(null);
                          setDialog({ mode: "edit", member: m });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        className={rowButton}
                        disabled={pending}
                        onClick={() => {
                          setNotice(null);
                          setDialog({ mode: "leaves", memberId: m.id });
                        }}
                      >
                        <CalendarOff className="h-3.5 w-3.5" /> Leaves
                      </button>
                      <button
                        type="button"
                        className={rowButton}
                        disabled={pending}
                        onClick={() => {
                          setNotice(null);
                          setDialog({ mode: "role", member: m });
                        }}
                      >
                        <UserCog className="h-3.5 w-3.5" /> Change Role
                      </button>
                      <button
                        type="button"
                        className={rowButton}
                        disabled={pending}
                        onClick={() => toggleStatus(m)}
                      >
                        {m.status === "active" ? (
                          <>
                            <UserX className="h-3.5 w-3.5" /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> Reactivate
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className={dangerButton}
                        disabled={pending}
                        onClick={() => {
                          setNotice(null);
                          setDialog({ mode: "delete", member: m });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-600">Owner only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && dialog.mode === "delete" && (
        <DeleteDialog
          key={`delete-${dialog.member.id}`}
          member={dialog.member}
          onClose={() => setDialog(null)}
        />
      )}

      {leavesMember && (
        <LeavesDialog
          key={`leaves-${leavesMember.id}`}
          member={leavesMember}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog && (dialog.mode === "add" || dialog.mode === "edit" || dialog.mode === "role") && (
        <StaffDialog
          key={dialog.mode === "add" ? "add" : `${dialog.mode}-${dialog.member.id}`}
          state={dialog}
          assignableRoles={assignableRoles}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function StaffDialog({
  state,
  assignableRoles,
  onClose,
}: {
  state: FormDialogState;
  assignableRoles: Role[];
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const member = state.mode === "add" ? null : state.member;
  useEscape(onClose);

  const title =
    state.mode === "add" ? "Add Staff" : state.mode === "edit" ? "Edit Staff" : "Change Role";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const contact = String(fd.get("contact") ?? "");
    const role = String(fd.get("role") ?? "");
    const status = String(fd.get("status") ?? "active");
    const joinedOn = String(fd.get("joinedOn") ?? "");

    startTransition(async () => {
      let res: StaffActionResult;
      if (state.mode === "add") {
        res = await addStaffAction({ name, contact, role, status, joinedOn });
      } else if (state.mode === "edit") {
        res = await editStaffAction(state.member.id, { name, contact, role, joinedOn });
      } else {
        res = await changeStaffRoleAction(state.member.id, role);
      }
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-dialog-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6"
      >
        <h2 id="staff-dialog-title" className="text-lg font-semibold text-zinc-50">
          {title}
        </h2>

        {state.mode === "role" && member && (
          <p className="text-sm text-zinc-400">
            Choose a new role for <span className="text-zinc-100">{member.name}</span>.
          </p>
        )}

        {state.mode !== "role" && (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Name</span>
              <input
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={member?.name ?? ""}
                className={inputClass}
                placeholder="Full name"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Email / Phone</span>
              <input
                name="contact"
                required
                maxLength={120}
                defaultValue={member?.contact ?? ""}
                className={inputClass}
                placeholder="name@example.com or +91 98765 43210"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-400">Joining date</span>
              <DateField name="joinedOn" defaultValue={member?.joinedOn ?? ""} />
            </label>
          </>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-zinc-400">Role</span>
          <select name="role" defaultValue={member?.role ?? assignableRoles[0]} className={inputClass}>
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        {state.mode === "add" && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-400">Status</span>
            <select name="status" defaultValue="active" className={inputClass}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        )}

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
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#d7fe3b] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LeavesDialog({ member, onClose }: { member: StaffRow; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEscape(onClose);

  function isoDay(offsetDays: number): string {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function pickFrom(v: string) {
    setFrom(v);
    // Keep "To" valid: empty or earlier than From becomes the same day.
    if (!to || to < v) setTo(v);
  }

  function quick(offsetDays: number) {
    const day = isoDay(offsetDays);
    setFrom(day);
    setTo(day);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const input = {
      type: String(fd.get("type") ?? ""),
      from,
      to,
      reason: String(fd.get("reason") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const res = await addLeaveAction(member.id, input);
      if (res.ok) {
        form.reset();
        setFrom("");
        setTo("");
      } else {
        setError(res.error);
      }
    });
  }

  function cancelLeave(id: string) {
    setError(null);
    startTransition(async () => {
      const res = await cancelLeaveAction(id);
      if (!res.ok) setError(res.error);
    });
  }

  const WHEN_STYLE = {
    current: "bg-amber-400/10 text-amber-300",
    upcoming: "bg-[#d7fe3b]/10 text-[#d7fe3b]",
    past: "bg-zinc-800 text-zinc-400",
  } as const;
  const WHEN_LABEL = { current: "On leave now", upcoming: "Upcoming", past: "Past" } as const;

  const chip =
    "rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-[#d7fe3b] hover:text-[#d7fe3b]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaves-dialog-title"
    >
      <div className="max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <div>
          <h2 id="leaves-dialog-title" className="text-lg font-semibold text-zinc-50">
            Leaves — {member.name}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">Joined: {member.joinedLabel}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-zinc-800 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Add leave</p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">Quick pick:</span>
            <button type="button" className={chip} onClick={() => quick(0)}>
              Today
            </button>
            <button type="button" className={chip} onClick={() => quick(1)}>
              Tomorrow
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-3 block space-y-1.5 sm:col-span-1">
              <span className="text-xs text-zinc-400">Type</span>
              <select name="type" defaultValue="casual" className={inputClass}>
                {(Object.keys(LEAVE_LABEL) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>
                    {LEAVE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-3 block space-y-1.5 sm:col-span-1">
              <span className="text-xs text-zinc-400">From</span>
              <DateField name="from" value={from} onChange={pickFrom} required />
            </label>
            <label className="col-span-3 block space-y-1.5 sm:col-span-1">
              <span className="text-xs text-zinc-400">To</span>
              <DateField name="to" value={to} onChange={setTo} min={from || undefined} required />
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">Reason (optional)</span>
            <input name="reason" maxLength={200} className={inputClass} placeholder="e.g. family function" />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#d7fe3b] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Add leave"}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">History</p>
          {member.leaves.length === 0 ? (
            <p className="text-sm text-zinc-500">No leaves recorded.</p>
          ) : (
            member.leaves.map((l) => (
              <div
                key={l.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-100">
                    {l.fromLabel === l.toLabel ? l.fromLabel : `${l.fromLabel} – ${l.toLabel}`}{" "}
                    <span className="text-zinc-500">
                      · {l.days} day{l.days === 1 ? "" : "s"} · {LEAVE_LABEL[l.type]}
                    </span>
                  </p>
                  {l.reason && <p className="mt-0.5 truncate text-xs text-zinc-400">{l.reason}</p>}
                  <span
                    className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${WHEN_STYLE[l.when]}`}
                  >
                    {WHEN_LABEL[l.when]}
                  </span>
                </div>
                {l.when !== "past" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => cancelLeave(l.id)}
                    className={dangerButton}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({ member, onClose }: { member: StaffRow; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscape(onClose);

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteStaffAction(member.id);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 id="delete-dialog-title" className="text-lg font-semibold text-zinc-50">
          Delete staff member?
        </h2>
        <p id="delete-dialog-desc" className="text-sm text-zinc-400">
          <span className="text-zinc-100">{member.name}</span> ({ROLE_LABEL[member.role]}) and their
          leave records will be permanently removed. This cannot be undone. To keep the record and
          only block access, use Deactivate instead.
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
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={pending}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}