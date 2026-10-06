"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import {
  addStaffAction,
  changeStaffRoleAction,
  deleteStaffAction,
  editStaffAction,
  setStaffStatusAction,
  type StaffActionResult,
} from "./actions";

type Role = "owner" | "manager" | "cashier" | "kitchen" | "waiter";

export interface StaffRow {
  id: string;
  name: string;
  contact: string;
  role: Role;
  status: "active" | "inactive";
  lastActiveLabel: string;
  editable: boolean;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  cashier: "Cashier",
  kitchen: "Kitchen",
  waiter: "Waiter",
};

type FormDialogState =
  | { mode: "add" }
  | { mode: "edit"; member: StaffRow }
  | { mode: "role"; member: StaffRow };

type DialogState = FormDialogState | { mode: "delete"; member: StaffRow };

const inputClass =
  "w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#d7fe3b] focus:outline-none";
const rowButton =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-[#d7fe3b] disabled:opacity-50";
const dangerButton =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Staff Management</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage restaurant staff and their access.</p>
        </div>
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

      {notice && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {notice}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email / Phone</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Active</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No staff yet. Use Add Staff to create the first member.
                </td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className={m.status === "inactive" ? "opacity-60" : undefined}>
                <td className="px-4 py-3 font-medium text-zinc-100">{m.name}</td>
                <td className="px-4 py-3 text-zinc-400">{m.contact}</td>
                <td className="px-4 py-3 text-zinc-300">{ROLE_LABEL[m.role]}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      m.status === "active"
                        ? "bg-[#d7fe3b]/10 text-[#d7fe3b]"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {m.status === "active" ? "Active" : "Inactive"}
                  </span>
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

      {dialog && dialog.mode !== "delete" && (
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    state.mode === "add" ? "Add Staff" : state.mode === "edit" ? "Edit Staff" : "Change Role";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "");
    const contact = String(fd.get("contact") ?? "");
    const role = String(fd.get("role") ?? "");
    const status = String(fd.get("status") ?? "active");

    startTransition(async () => {
      let res: StaffActionResult;
      if (state.mode === "add") {
        res = await addStaffAction({ name, contact, role, status });
      } else if (state.mode === "edit") {
        res = await editStaffAction(state.member.id, { name, contact, role });
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

function DeleteDialog({ member, onClose }: { member: StaffRow; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
          <span className="text-zinc-100">{member.name}</span> ({ROLE_LABEL[member.role]}) will be
          permanently removed. This cannot be undone. To keep the record and only block access, use
          Deactivate instead.
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