"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock } from "lucide-react";
import { verifyPotsPin, type PotsPinState } from "@/server/modules/auth/pots-pin-actions";

const initialState: PotsPinState = { status: "idle" };

export function PotsPinForm() {
  const [state, formAction, isPending] = useActionState(verifyPotsPin, initialState);
  const [showPin, setShowPin] = useState(false);

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-zinc-900 p-2 text-[var(--radium-green)]">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">
            Financial pots — PIN required
          </h1>
          <p className="text-xs text-zinc-500">
            Demo PIN protection only. Not a substitute for real security on
            production financial data.
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="pin"
            className="block text-xs font-medium uppercase tracking-wider text-zinc-400"
          >
            PIN
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="pin"
              name="pin"
              type={showPin ? "text" : "password"}
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={8}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm tracking-widest text-zinc-100 outline-none focus:border-[var(--radium-green)]"
              placeholder="••••"
            />
            <button
              type="button"
              onClick={() => setShowPin((v) => !v)}
              className="shrink-0 rounded-lg border border-zinc-800 p-2 text-zinc-400 transition-colors hover:text-zinc-200"
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {state.status === "error" && (
          <p role="alert" className="text-xs text-red-400">
            {state.message}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/owner"
            className="flex-1 rounded-lg border border-zinc-800 px-4 py-2 text-center text-sm text-zinc-300 transition-colors hover:border-zinc-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-lg bg-[var(--radium-green)] px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-60"
          >
            {isPending ? "Verifying…" : "Verify"}
          </button>
        </div>
      </form>
    </div>
  );
}