"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { demoLogin, type DemoLoginState } from "@/server/modules/auth/demo-actions";

const initialState: DemoLoginState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[var(--radius-brand)] bg-[var(--color-gold-500)] px-6 py-2.5 text-sm font-medium text-[#0a0a0a] disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(demoLogin, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-0)] px-6">
      <div className="w-full max-w-sm rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8">
        <Link
          href="/"
          className="text-lg text-[var(--color-gold-400)]"
          style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
        >
          Tablor&apos;s
        </Link>
        <h1 className="mt-4 text-xl text-[var(--color-text-primary)]">Sign in</h1>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="text-sm text-[var(--color-text-secondary)]">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className="mt-1.5 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-gold-500)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-[var(--color-text-secondary)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1.5 w-full rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-gold-500)]"
            />
          </div>

          {state.status === "error" && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          )}

          <SubmitButton />
        </form>

        <div className="mt-6 rounded-[var(--radius-brand)] border border-[var(--color-border)] bg-[var(--color-surface-0)] p-4 text-xs text-[var(--color-text-muted)]">
          <p className="text-[var(--color-text-secondary)]">Demo credentials</p>
          <p className="mt-1">Owner: owner / demo-owner</p>
          <p>Kitchen: kitchen / demo-kitchen</p>
          <p>Admin: admin / demo-admin</p>
        </div>
      </div>
    </div>
  );
}
